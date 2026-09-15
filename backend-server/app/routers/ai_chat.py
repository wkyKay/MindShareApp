"""AI 对话接口（基于 LangGraph Agent）。

完全兼容原有 SSE 事件格式，新增 theme_proposal 事件。
"""

import json
from typing import AsyncIterator, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from openai import OpenAIError
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..agent.graph import run_agent_stream
from ..agent.nodes import build_blog_context
from ..auth import get_current_user
from ..database import get_db
from ..models import Post, User
from ..rag.retriever import RetrievedChunk, retrieve as rag_retrieve

router = APIRouter()


class AiChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1)


class AiChatRequest(BaseModel):
    messages: list[AiChatMessage] = Field(default_factory=list)
    # 可选：当前激活的主题模式，用于 Agent 生成主题时参考
    current_mode: Literal["light", "dark"] = "light"


class AiBlogChatRequest(BaseModel):
    post_id: int
    messages: list[AiChatMessage] = Field(default_factory=list)
    mode: Literal["read", "edit"] = "read"


def _sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _load_existing_theme(user: User, mode: str) -> Optional[Dict[str, str]]:
    """读取用户已有的自定义主题（增量字典）。"""
    import json as _json

    from ..schemas import VALID_THEME_COLOR_KEYS

    raw = user.custom_light_theme if mode == "light" else user.custom_dark_theme
    if not raw:
        return None
    try:
        data = _json.loads(raw)
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if k in VALID_THEME_COLOR_KEYS}
    except (_json.JSONDecodeError, TypeError):
        return None
    return None


@router.post("/chat/stream")
async def stream_ai_chat(
    payload: AiChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """AI 对话流式接口（Agent 版本）。

    SSE 事件类型：
    - start: 流开始
    - delta: 增量文本
    - theme_proposal: 主题方案提议（新增，结构化数据）
    - done: 流结束
    - error: 错误信息
    """
    # 提取最后一条用户消息作为 RAG 检索查询
    last_user_msg = ""
    for msg in reversed(payload.messages):
        if msg.role == "user":
            last_user_msg = msg.content
            break

    # RAG 检索（保留原有能力）
    chunks: List[RetrievedChunk] = []
    if last_user_msg.strip():
        try:
            chunks = rag_retrieve(last_user_msg, current_user, db)
        except Exception:
            # RAG 失败不影响主流程
            chunks = []

    # 构建 RAG 上下文文本
    rag_context = ""
    if chunks:
        parts = ["以下是与用户问题相关的站内博客内容，请参考这些内容回答：\n"]
        for item in chunks:
            parts.append(f"【来源：{item.post_title}】\n{item.chunk.content}\n")
        parts.append("如果以下内容不足以回答用户问题，请诚实说明，并基于你的知识补充。\n")
        rag_context = "\n".join(parts)

    # 读取用户已有自定义主题
    existing_theme = _load_existing_theme(current_user, payload.current_mode)

    # 转换消息格式
    messages_dict = [m.model_dump() for m in payload.messages]

    async def generate() -> AsyncIterator[str]:
        try:
            async for event in run_agent_stream(
                messages=messages_dict,
                rag_context=rag_context,
                current_mode=payload.current_mode,
                existing_custom_theme=existing_theme,
                db=db,
                current_user=current_user,
            ):
                if await request.is_disconnected():
                    return
                yield _sse_event(event)
        except OpenAIError as error:
            yield _sse_event({"type": "error", "message": f"DeepSeek 调用失败：{error}"})
        except Exception as exc:
            yield _sse_event({"type": "error", "message": f"AI 回复失败：{exc}"})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/blog/stream")
async def stream_blog_ai_chat(
    payload: AiBlogChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """博客专属 AI 流式接口。

    - read 模式：把该博客正文作为上下文，进行问答。
    - edit 模式：仅博客作者可用，根据用户要求输出修改提案（标题/摘要/正文）。

    SSE 事件类型：start / delta / post_edit_proposal / done / error。
    """
    row = (
        db.query(Post, User)
        .join(User, User.id == Post.author_id)
        .filter(Post.id == payload.post_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="博客不存在")
    post, author = row

    if post.status == "deleted" and current_user.id != post.author_id:
        raise HTTPException(status_code=404, detail="博客已删除")
    if post.visibility == "private" and current_user.id != post.author_id:
        raise HTTPException(status_code=403, detail="无权查看该博客")

    is_owner = post.author_id == current_user.id
    if payload.mode == "edit" and not is_owner:
        raise HTTPException(status_code=403, detail="只能编辑自己的博客")

    blog_context = build_blog_context(post.title, post.summary, post.body)
    # read 模式跳过意图检测直达 chat；edit 模式仅允许 chat / post_edit
    intent_scope: Optional[List[str]] = [] if payload.mode == "read" else ["chat", "post_edit"]

    async def generate() -> AsyncIterator[str]:
        try:
            async for event in run_agent_stream(
                messages=[m.model_dump() for m in payload.messages],
                db=db,
                current_user=current_user,
                blog_context=blog_context,
                current_author_id=post.author_id,
                current_author_name=author.username,
                intent_scope=intent_scope,
            ):
                if await request.is_disconnected():
                    return
                yield _sse_event(event)
        except OpenAIError as error:
            yield _sse_event({"type": "error", "message": f"DeepSeek 调用失败：{error}"})
        except Exception as exc:
            yield _sse_event({"type": "error", "message": f"AI 回复失败：{exc}"})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
