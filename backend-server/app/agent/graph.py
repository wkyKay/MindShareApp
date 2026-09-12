"""Agent 工作流图构建与流式运行。"""

import json
from typing import Any, AsyncIterator, Dict, List, Literal, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from ..config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
from .nodes import (
    chat_response_node,
    generate_theme_node,
    intent_detect_node,
    route_by_intent,
)
from .state import AgentState


def build_agent_graph() -> StateGraph:
    """构建 Agent 工作流图。

    流程：
        intent_detect
            ├── "chat" ──▶ chat_response ──▶ END
            └── "theme" ──▶ generate_theme ──▶ END
    """
    workflow = StateGraph(AgentState)

    workflow.add_node("intent_detect", intent_detect_node)
    workflow.add_node("generate_theme", generate_theme_node)
    workflow.add_node("chat_response", chat_response_node)

    workflow.set_entry_point("intent_detect")

    workflow.add_conditional_edges(
        "intent_detect",
        route_by_intent,
        {
            "chat": "chat_response",
            "theme": "generate_theme",
        },
    )

    workflow.add_edge("generate_theme", END)
    workflow.add_edge("chat_response", END)

    return workflow


def _get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        model=DEEPSEEK_MODEL,
        temperature=0.7,
    )


CHAT_SYSTEM_PROMPT_TEMPLATE = """你是一个知识博客 App 的 AI 助手，擅长回答用户问题。

{rag_context}

请用中文回答用户问题。如果提供了参考资料，请优先基于资料回答；如果资料不足，请诚实说明，再基于你的知识补充。"""


async def run_agent_stream(
    messages: List[Dict[str, str]],
    rag_context: str = "",
    current_mode: Literal["light", "dark"] = "light",
    existing_custom_theme: Optional[Dict[str, str]] = None,
) -> AsyncIterator[Dict[str, Any]]:
    """运行 Agent 并以 SSE 事件形式输出结果。

    Args:
        messages: 对话历史，每条包含 role 和 content
        rag_context: RAG 检索到的上下文文本
        current_mode: 当前激活的主题模式
        existing_custom_theme: 用户已有的自定义主题

    Yields:
        SSE 事件字典：
        - {"type": "start"}
        - {"type": "delta", "content": "..."}
        - {"type": "theme_proposal", "theme": {...}, "description": "..."}
        - {"type": "done"}
        - {"type": "error", "message": "..."}
    """
    # 将字典消息转换为 LangChain Message 对象
    lc_messages: list = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            lc_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))
        elif role == "system":
            lc_messages.append(SystemMessage(content=content))

    # 构建初始状态
    initial_state: AgentState = {
        "messages": lc_messages,
        "intent": "chat",
        "theme_proposal": None,
        "theme_description": None,
        "rag_context": rag_context,
        "final_text": None,
        "current_mode": current_mode,
        "existing_custom_theme": existing_custom_theme,
    }

    try:
        workflow = build_agent_graph()
        graph = workflow.compile()

        intent_result: Optional[str] = None

        async for step_output in graph.astream(initial_state):
            # 每个节点的输出是一个 dict，键是节点名
            for node_name, node_output in step_output.items():
                if node_name == "intent_detect":
                    intent_result = node_output.get("intent")
                    yield {"type": "start"}

                    if intent_result == "chat":
                        # chat 分支：直接流式输出 LLM 回复
                        async for delta in _stream_chat_response(
                            lc_messages, rag_context
                        ):
                            yield {"type": "delta", "content": delta}
                        yield {"type": "done"}
                        return

                elif node_name == "generate_theme":
                    theme_colors = node_output.get("theme_proposal") or {}
                    theme_desc = node_output.get("theme_description") or ""

                    # 逐字输出描述文本，模拟打字机效果
                    if theme_desc:
                        for char in theme_desc:
                            yield {"type": "delta", "content": char}

                    # 发送主题方案结构化事件
                    yield {
                        "type": "theme_proposal",
                        "theme": theme_colors,
                        "description": theme_desc,
                    }
                    yield {"type": "done"}
                    return

        # 如果循环结束没有返回（异常情况）
        if intent_result is None:
            yield {"type": "error", "message": "Agent 运行异常：未能识别意图。"}
        else:
            yield {"type": "done"}

    except Exception as exc:
        yield {"type": "error", "message": "Agent 运行失败：{}".format(exc)}


async def _stream_chat_response(
    messages: list,
    rag_context: str = "",
) -> AsyncIterator[str]:
    """chat 分支：流式调用 LLM 生成回复。"""
    llm = _get_llm()

    # 构建带 RAG 上下文的消息列表
    final_messages: list = []
    if rag_context:
        system_prompt = CHAT_SYSTEM_PROMPT_TEMPLATE.format(rag_context=rag_context)
    else:
        system_prompt = CHAT_SYSTEM_PROMPT_TEMPLATE.format(
            rag_context="（当前没有检索到相关的站内博客内容，请基于你的知识回答。）"
        )

    final_messages.append(SystemMessage(content=system_prompt))
    # 加入用户对话历史（跳过 system 消息，因为我们已经加了自己的 system）
    for msg in messages:
        if isinstance(msg, (HumanMessage, AIMessage)):
            final_messages.append(msg)

    async for chunk in llm.astream(final_messages):
        if chunk.content:
            yield chunk.content
