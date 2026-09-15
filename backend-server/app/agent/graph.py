"""Agent 工作流图构建与流式运行。"""

from typing import Any, AsyncIterator, Dict, List, Literal, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, StateGraph

from .nodes import (
    generate_theme_node,
    intent_detect_node,
    make_agent_reason_node,
    make_tool_executor_node,
    post_edit_proposal_node,
    route_after_reason,
    route_by_intent,
)
from .state import AgentState
from .tools import build_tools

# 工具名 → 前端展示文案
TOOL_DISPLAY = {
    "search_posts": "正在搜索站内文章",
    "rag_retrieve": "正在检索站内文章",
    "get_post": "正在查看文章全文",
    "list_collections": "正在查看你的收藏",
}


def _tool_status(name: str, status: str) -> Dict[str, str]:
    payload: Dict[str, str] = {"type": "tool_status", "tool": name, "status": status}
    if status == "running":
        payload["display"] = TOOL_DISPLAY.get(name, "正在执行工具")
    return payload


def build_agent_graph(tools: list, skip_intent: bool = False):
    """构建统一 Agent 工作流图。

    流程：
        intent_detect
            ├── "chat" ──▶ agent_reason ⇅ tool_executor ──▶ END
            ├── "theme" ──▶ generate_theme ──▶ END
            └── "post_edit" ──▶ post_edit_proposal ──▶ END

    skip_intent=True 时（博客 read 模式）直接以 agent_reason 为入口。
    """
    workflow = StateGraph(AgentState)

    workflow.add_node("intent_detect", intent_detect_node)
    workflow.add_node("generate_theme", generate_theme_node)
    workflow.add_node("post_edit", post_edit_proposal_node)
    workflow.add_node("agent_reason", make_agent_reason_node(tools))
    workflow.add_node("tool_executor", make_tool_executor_node(tools))

    if skip_intent:
        workflow.set_entry_point("agent_reason")
    else:
        workflow.set_entry_point("intent_detect")
        workflow.add_conditional_edges(
            "intent_detect",
            route_by_intent,
            {
                "chat": "agent_reason",
                "theme": "generate_theme",
                "post_edit": "post_edit",
            },
        )

    workflow.add_conditional_edges(
        "agent_reason",
        route_after_reason,
        {
            "tool_executor": "tool_executor",
            "end": END,
        },
    )
    workflow.add_edge("tool_executor", "agent_reason")
    workflow.add_edge("generate_theme", END)
    workflow.add_edge("post_edit", END)

    return workflow.compile()


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


async def run_agent_stream(
    messages: List[Dict[str, str]],
    rag_context: str = "",
    current_mode: Literal["light", "dark"] = "light",
    existing_custom_theme: Optional[Dict[str, str]] = None,
    db=None,
    current_user=None,
    blog_context: Optional[str] = None,
    current_author_id: Optional[int] = None,
    current_author_name: Optional[str] = None,
    intent_scope: Optional[List[str]] = None,
) -> AsyncIterator[Dict[str, Any]]:
    """运行统一 Agent 并以 SSE 事件形式输出结果。

    Yields:
        - {"type": "start"}
        - {"type": "tool_status", "tool": "...", "status": "running"|"done", "display": "..."}
        - {"type": "delta", "content": "..."}
        - {"type": "theme_proposal", "theme": {...}, "description": "..."}
        - {"type": "post_edit_proposal", "title": ..., "summary": ..., "body": ..., "description": ...}
        - {"type": "done"}
        - {"type": "error", "message": "..."}
    """
    lc_messages = _to_lc_messages(messages)

    tools = build_tools(current_user, db) if (current_user is not None and db is not None) else []
    # 仅 blog read 模式（显式传入空列表）跳过意图检测；主聊天未传（None）走默认检测
    skip_intent = intent_scope == []

    initial_state: AgentState = {
        "messages": lc_messages,
        "intent": "chat",
        "theme_proposal": None,
        "theme_description": None,
        "rag_context": rag_context,
        "final_text": None,
        "current_mode": current_mode,
        "existing_custom_theme": existing_custom_theme,
        "intent_scope": intent_scope or ["chat", "theme"],
        "blog_context": blog_context,
        "current_author_id": current_author_id,
        "current_author_name": current_author_name,
        "current_user_id": current_user.id if current_user else None,
        "current_user_name": current_user.username if current_user else None,
        "post_edit_proposal": None,
        "tool_call_count": 0,
    }

    try:
        graph = build_agent_graph(tools, skip_intent=skip_intent)

        started = False
        pending_tools: List[str] = []

        async for step_output in graph.astream(initial_state):
            for node_name, node_output in step_output.items():
                if node_name == "intent_detect":
                    if not started:
                        yield {"type": "start"}
                        started = True
                    continue

                if not started:
                    yield {"type": "start"}
                    started = True

                if node_name == "agent_reason":
                    last_msg = node_output.get("messages", [])[-1] if node_output.get("messages") else None
                    tool_calls = getattr(last_msg, "tool_calls", None)
                    final_text = node_output.get("final_text")

                    if tool_calls:
                        pending_tools = [c.get("name") for c in tool_calls]
                        for name in pending_tools:
                            yield _tool_status(name, "running")
                    elif final_text:
                        for char in final_text:
                            yield {"type": "delta", "content": char}
                        yield {"type": "done"}
                        return

                elif node_name == "tool_executor":
                    for name in pending_tools:
                        yield _tool_status(name, "done")
                    pending_tools = []

                elif node_name == "generate_theme":
                    theme_colors = node_output.get("theme_proposal") or {}
                    theme_desc = node_output.get("theme_description") or ""
                    if theme_desc:
                        for char in theme_desc:
                            yield {"type": "delta", "content": char}
                    yield {
                        "type": "theme_proposal",
                        "theme": theme_colors,
                        "description": theme_desc,
                    }
                    yield {"type": "done"}
                    return

                elif node_name == "post_edit":
                    proposal = node_output.get("post_edit_proposal") or {}
                    description = proposal.get("description") or ""
                    if description:
                        for char in description:
                            yield {"type": "delta", "content": char}
                    yield {
                        "type": "post_edit_proposal",
                        "title": proposal.get("title"),
                        "summary": proposal.get("summary"),
                        "body": proposal.get("body"),
                        "description": description,
                    }
                    yield {"type": "done"}
                    return

        # 未命中任何终态分支（异常情况）
        if started:
            yield {"type": "done"}
        else:
            yield {"type": "error", "message": "Agent 运行异常：未能识别意图。"}

    except Exception as exc:
        yield {"type": "error", "message": "Agent 运行失败：{}".format(exc)}
