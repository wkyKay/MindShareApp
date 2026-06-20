import json
from typing import AsyncIterator, List, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
from ..database import get_db
from ..models import User
from ..rag.retriever import retrieve as rag_retrieve, RetrievedChunk

router = APIRouter()


class AiChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1)


class AiChatRequest(BaseModel):
    messages: list[AiChatMessage] = Field(default_factory=list)


def _sse_event(payload: dict[str, str]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _create_deepseek_client() -> AsyncOpenAI:
    if not DEEPSEEK_API_KEY:
        raise HTTPException(status_code=500, detail="DeepSeek API key is not configured")
    return AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)


def _build_rag_context(chunks: List[RetrievedChunk]) -> str:
    if not chunks:
        return ""
    parts = ["以下是与用户问题相关的站内博客内容，请参考这些内容回答：\n"]
    for item in chunks:
        parts.append(f"【来源：{item.post_title}】\n{item.chunk.content}\n")
    parts.append("如果以下内容不足以回答用户问题，请诚实说明，并基于你的知识补充。\n")
    return "\n".join(parts)


@router.post("/chat/stream")
async def stream_ai_chat(
    payload: AiChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    client = _create_deepseek_client()

    # 提取最后一条用户消息作为检索查询
    last_user_msg = ""
    for msg in reversed(payload.messages):
        if msg.role == "user":
            last_user_msg = msg.content
            break

    # RAG 检索
    chunks: List[RetrievedChunk] = []
    if last_user_msg.strip():
        chunks = rag_retrieve(last_user_msg, current_user, db)

    # 构建消息列表
    messages: list[dict] = []

    if chunks:
        context = _build_rag_context(chunks)
        messages.append({"role": "system", "content": context})

    for msg in payload.messages:
        messages.append(msg.model_dump())

    async def generate() -> AsyncIterator[str]:
        yield _sse_event({"type": "start"})
        try:
            stream = await client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=messages,
                stream=True,
            )
            async for chunk in stream:
                if await request.is_disconnected():
                    return
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield _sse_event({"type": "delta", "content": delta})
            yield _sse_event({"type": "done"})
        except OpenAIError as error:
            yield _sse_event({"type": "error", "message": f"DeepSeek 调用失败：{error}"})
        except Exception:
            yield _sse_event({"type": "error", "message": "AI 回复失败，请稍后重试。"})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
