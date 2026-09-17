"""AI 对话接口（基于 LangGraph Agent）。

升级点：
- 移除前置盲检索，改为 Agent 按需调用 rag_retrieve 工具
- 引用溯源：回答中带 references 数据，前端可展示
- SSE 事件格式完全兼容

SSE 事件类型：
- start, delta, tool_status, done, error（原有）
- references: 引用列表（新增，可选）
- cached: 缓存命中标记（新增，可选）
"""

import json
import logging
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
from ..rag.semantic_cache import get_cache, is_enabled as cache_enabled, set_cache

router = APIRouter()
logger = logging.getLogger(__name__)


class AiChatMessage(BaseModel):
    """单条对话消息。"""

    role: Literal["user", "assistant", "system"] = Field(
        ..., description="消息角色：user=用户, assistant=AI, system=系统提示词"
    )
    content: str = Field(..., min_length=1, description="消息文本内容，不能为空字符串")


class AiChatRequest(BaseModel):
    """通用 AI 对话请求体。"""

    messages: list[AiChatMessage] = Field(
        default_factory=list,
        description="完整对话历史列表，按时间顺序排列，最后一条应为用户消息",
    )
    current_mode: Literal["light", "dark"] = Field(
        default="light",
        description="当前用户界面主题模式，用于 AI 生成主题相关建议时参考",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "messages": [
                        {"role": "system", "content": "你是一个乐于助人的 AI 助手。"},
                        {"role": "user", "content": "请解释一下什么是 RAG？"},
                    ],
                    "current_mode": "light",
                }
            ]
        }
    }


class AiBlogChatRequest(BaseModel):
    """博客专属 AI 对话请求体。"""

    post_id: int = Field(..., gt=0, description="博客文章 ID，用于加载文章上下文")
    messages: list[AiChatMessage] = Field(
        default_factory=list,
        description="针对该博客的对话历史列表，按时间顺序排列",
    )
    mode: Literal["read", "edit"] = Field(
        default="read",
        description="对话模式：read=阅读提问模式，edit=编辑辅助模式（仅作者可用）",
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "post_id": 123,
                    "messages": [{"role": "user", "content": "这篇文章的主要观点是什么？"}],
                    "mode": "read",
                }
            ]
        }
    }


def _sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _load_existing_theme(user: User, mode: str) -> Optional[Dict[str, str]]:
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


@router.post(
    "/chat/stream",
    summary="AI 流式对话（通用）",
    response_description="SSE 事件流",
    responses={
        200: {"description": "成功建立 SSE 连接，流式返回 AI 回复"},
        401: {"description": "未登录或 token 无效"},
        422: {"description": "请求参数校验失败"},
    },
)
async def stream_ai_chat(
    payload: AiChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """通用 AI 对话流式接口（基于 LangGraph Agent）。

    Agent 会根据对话内容**按需调用 RAG 检索工具**，而非每次都前置检索。
    启用语义缓存时，相同问题会直接命中缓存返回。

    ## SSE 事件类型

    | 事件类型 | 说明 |
    |---|---|
    | `start` | 回复开始 |
    | `delta` | 增量文本片段 |
    | `tool_status` | 工具调用状态更新 |
    | `references` | 引用文献列表（可选） |
    | `cached` | 命中语义缓存标记（可选） |
    | `done` | 回复结束 |
    | `error` | 发生错误 |

    ## 注意事项

    - 需要 Bearer Token 认证
    - 响应 `Content-Type` 为 `text/event-stream`
    - 客户端断开连接后服务端会自动停止生成
    """
    last_user_msg = ""
    for msg in reversed(payload.messages):
        if msg.role == "user":
            last_user_msg = msg.content
            break

    # 语义缓存检查（默认关闭）
    cached_result = None
    if cache_enabled() and last_user_msg.strip():
        cached_result = get_cache(last_user_msg)

    existing_theme = _load_existing_theme(current_user, payload.current_mode)
    messages_dict = [m.model_dump() for m in payload.messages]

    async def generate() -> AsyncIterator[str]:
        # 缓存命中直接返回
        if cached_result:
            yield _sse_event({"type": "start"})
            yield _sse_event({"type": "cached", "from_cache": True})
            answer = cached_result.get("answer", "")
            for char in answer:
                yield _sse_event({"type": "delta", "content": char})
            refs = cached_result.get("references", [])
            if refs:
                yield _sse_event({"type": "references", "references": refs})
            yield _sse_event({"type": "done"})
            return

        try:
            full_answer = ""
            references_list = []

            async for event in run_agent_stream(
                messages=messages_dict,
                rag_context="",  # 不再预注入，Agent 按需调用工具
                current_mode=payload.current_mode,
                existing_custom_theme=existing_theme,
                db=db,
                current_user=current_user,
            ):
                if await request.is_disconnected():
                    return

                # 收集回答文本，用于缓存
                if event.get("type") == "delta":
                    full_answer += event.get("content", "")

                # 收集引用信息（从 tool_result 中提取，后续优化）
                # 这里先留空，引用溯源的完整实现在前端解析 [n] 标记

                yield _sse_event(event)

            # 写入缓存（仅成功的完整回答）
            if cache_enabled() and full_answer and len(full_answer) > 50:
                try:
                    set_cache(last_user_msg, full_answer, references_list)
                except Exception:
                    pass

        except OpenAIError as error:
            yield _sse_event({"type": "error", "message": f"DeepSeek 调用失败：{error}"})
        except Exception as exc:
            logger.exception("AI chat stream failed")
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


@router.post(
    "/blog/stream",
    summary="博客专属 AI 流式对话",
    response_description="SSE 事件流",
    responses={
        200: {"description": "成功建立 SSE 连接，流式返回 AI 回复"},
        401: {"description": "未登录或 token 无效"},
        403: {"description": "无权查看该博客，或非作者使用 edit 模式"},
        404: {"description": "博客不存在或已删除"},
        422: {"description": "请求参数校验失败"},
    },
)
async def stream_blog_ai_chat(
    payload: AiBlogChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """针对单篇博客文章的 AI 对话流式接口。

    会将博客标题、摘要、正文作为上下文注入 Agent，支持两种模式：

    - **read 模式**：读者就文章内容提问，所有可见该博客的用户均可使用
    - **edit 模式**：作者对文章进行编辑辅助（润色、改写、扩写等），仅作者可用

    ## SSE 事件类型

    与 `/chat/stream` 一致：`start` / `delta` / `tool_status` /
    `references` / `done` / `error`。

    ## 权限校验

    - 已删除的博客：仅作者可访问
    - 私密博客：仅作者可访问
    - edit 模式：仅作者可使用
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
            logger.exception("Blog AI chat stream failed")
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
