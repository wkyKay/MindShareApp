import asyncio
import json
from typing import AsyncIterator, Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..auth import get_current_user
from ..models import User


router = APIRouter()


class AiChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1)


class AiChatRequest(BaseModel):
    messages: list[AiChatMessage] = Field(default_factory=list)


def _sse_event(payload: dict[str, str]) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/chat/stream")
async def stream_ai_chat(
    payload: AiChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    async def generate() -> AsyncIterator[str]:
        latest_question = next(
            (message.content.strip() for message in reversed(payload.messages) if message.role == "user" and message.content.strip()),
            "这个问题",
        )
        mock_reply = (
            f"你好，{current_user.display_name}。我已经收到你的问题：{latest_question}。"
            "这是一个用于测试 SSE 流式输出的 mock 长回复，会被后端拆成很多小片段逐步返回，"
            "这样前端可以验证消息气泡是否会持续增长、列表是否能自动滚动到底部、停止按钮是否能中断请求，"
            "以及 FlatList 在消息数量变多时是否仍然保持流畅。后续接入真实大模型时，只需要把这里的 mock 片段替换为模型 SDK 的 stream 迭代结果即可。"
        )

        yield _sse_event({"type": "start"})
        for index in range(0, len(mock_reply), 5):
            if await request.is_disconnected():
                return
            yield _sse_event({"type": "delta", "content": mock_reply[index : index + 5]})
            await asyncio.sleep(0.06)
        yield _sse_event({"type": "done"})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
