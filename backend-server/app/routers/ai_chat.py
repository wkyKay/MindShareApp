import json
from typing import AsyncIterator, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI, OpenAIError
from pydantic import BaseModel, Field

from ..auth import get_current_user
from ..config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
from ..models import User


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


@router.post("/chat/stream")
async def stream_ai_chat(
    payload: AiChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    client = _create_deepseek_client()

    async def generate() -> AsyncIterator[str]:
        yield _sse_event({"type": "start"})
        try:
            stream = await client.chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[message.model_dump() for message in payload.messages],
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
