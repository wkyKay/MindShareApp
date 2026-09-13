"""博客专属 AI Agent：博客解读（read）与博客内容编辑（edit）。

独立于通用 Agent（chat/theme），不影响原有 /ai/chat/stream 的行为。
"""

from typing import Any, AsyncIterator, Dict, List, Literal, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from ..config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL

# 博客正文作为 prompt 上下文的最大字符数，避免超出模型 token 上限
BLOG_CONTEXT_MAX_CHARS = 8000


class BlogIntentDetection(BaseModel):
    """博客编辑场景下的意图分类。"""

    intent: Literal["chat", "post_edit"] = Field(
        description="chat 表示仅提问/讨论博客内容，post_edit 表示要修改博客标题、摘要或正文"
    )


class PostEditProposal(BaseModel):
    """博客内容修改提案。"""

    title: str = Field(description="修改后的完整标题")
    summary: Optional[str] = Field(default=None, description="修改后的摘要，可为空")
    body: str = Field(description="修改后的完整正文 Markdown")
    description: str = Field(description="用中文简述本次修改的要点，2-3 句")


def _get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        model=DEEPSEEK_MODEL,
        temperature=0.7,
    )


def _build_blog_context(title: str, summary: Optional[str], body: str) -> str:
    parts = [f"# {title}"]
    if summary:
        parts.append(f"摘要：{summary}")
    parts.append("正文：\n" + body[:BLOG_CONTEXT_MAX_CHARS])
    return "\n\n".join(parts)


def _to_lc_messages(messages: List[Dict[str, str]]) -> list:
    lc_messages = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            lc_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))
        elif role == "system":
            lc_messages.append(SystemMessage(content=content))
    return lc_messages


BLOG_READ_SYSTEM_PROMPT = """你是一个知识博客 App 的 AI 助手。用户正在阅读一篇博客，并可能针对这篇博客提问。

以下是这篇博客的内容：

{blog_context}

请用中文回答用户问题。回答时优先基于上面的博客内容；如果博客内容不足以回答，请诚实说明，再基于你的知识补充。"""


BLOG_EDIT_INTENT_PROMPT = """判断用户最后一条消息的意图：
- "post_edit"：用户要求修改这篇博客的标题、摘要或正文内容
- "chat"：其他情况（提问、讨论、评价等，不涉及修改）

只输出分类结果。"""


BLOG_EDIT_SYSTEM_PROMPT = """你是一个博客内容编辑助手。用户会提出修改要求，你需要输出修改后的完整内容。

当前博客内容：

{blog_context}

要求：
1. 根据用户要求修改博客，输出修改后的完整标题、摘要和正文
2. 正文保持 Markdown 格式，尽量保留原文结构，只改动用户要求的部分
3. 摘要用一句话概括正文内容，可为空
4. 用中文写一段 2-3 句的修改说明，说明你做了哪些改动

只输出结构化结果。"""


async def _stream_chat(messages: list, system_prompt: str) -> AsyncIterator[str]:
    llm = _get_llm()
    final_messages = [SystemMessage(content=system_prompt)]
    for msg in messages:
        if isinstance(msg, (HumanMessage, AIMessage)):
            final_messages.append(msg)

    async for chunk in llm.astream(final_messages):
        if chunk.content:
            yield chunk.content


async def run_blog_agent_stream(
    messages: List[Dict[str, str]],
    title: str,
    summary: Optional[str],
    body: str,
    mode: Literal["read", "edit"],
) -> AsyncIterator[Dict[str, Any]]:
    """运行博客 AI，以 SSE 事件字典流式输出。

    read 模式：直接基于博客内容聊天。
    edit 模式：先判断意图，chat 则聊天，post_edit 则输出结构化修改提案。
    """
    lc_messages = _to_lc_messages(messages)
    blog_context = _build_blog_context(title, summary, body)

    yield {"type": "start"}

    try:
        if mode == "read":
            system_prompt = BLOG_READ_SYSTEM_PROMPT.format(blog_context=blog_context)
            async for delta in _stream_chat(lc_messages, system_prompt):
                yield {"type": "delta", "content": delta}
            yield {"type": "done"}
            return

        # edit 模式：意图检测
        llm = _get_llm()
        last_user_messages = [m for m in lc_messages if isinstance(m, HumanMessage)][-3:]
        detect_messages = [
            SystemMessage(content=BLOG_EDIT_INTENT_PROMPT),
            HumanMessage(
                content="请判断以下用户消息的意图：\n\n"
                + "\n".join(f"用户：{m.content}" for m in last_user_messages)
            ),
        ]
        structured_llm = llm.with_structured_output(BlogIntentDetection)
        intent_result: BlogIntentDetection = await structured_llm.ainvoke(detect_messages)

        if intent_result.intent == "chat":
            system_prompt = BLOG_READ_SYSTEM_PROMPT.format(blog_context=blog_context)
            async for delta in _stream_chat(lc_messages, system_prompt):
                yield {"type": "delta", "content": delta}
            yield {"type": "done"}
            return

        # post_edit：生成结构化修改提案
        proposal_llm = llm.with_structured_output(PostEditProposal)
        recent_messages = lc_messages[-8:]
        edit_messages = [
            SystemMessage(content=BLOG_EDIT_SYSTEM_PROMPT.format(blog_context=blog_context)),
        ]
        for msg in recent_messages:
            if isinstance(msg, HumanMessage):
                edit_messages.append(HumanMessage(content=msg.content))
            elif isinstance(msg, AIMessage):
                edit_messages.append(AIMessage(content=msg.content))

        proposal: PostEditProposal = await proposal_llm.ainvoke(edit_messages)

        if proposal.description:
            for char in proposal.description:
                yield {"type": "delta", "content": char}

        yield {
            "type": "post_edit_proposal",
            "title": proposal.title,
            "summary": proposal.summary,
            "body": proposal.body,
            "description": proposal.description,
        }
        yield {"type": "done"}
        return

    except Exception as exc:
        yield {"type": "error", "message": f"AI 回复失败：{exc}"}
