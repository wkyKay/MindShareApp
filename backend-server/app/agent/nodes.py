"""Agent 工作流节点实现。"""

import asyncio
import json
from typing import Any, Dict, List, Literal, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI

from ..config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
from .schema import IntentDetection, PostEditProposal, ThemeProposal
from .state import AgentState
from .tools import TOOL_RESULT_MAX_CHARS, TOOL_TIMEOUT_SECONDS

# 博客正文作为 prompt 上下文的最大字符数
BLOG_CONTEXT_MAX_CHARS = 8000

# 工具循环轮次上限
MAX_TOOL_ROUNDS = 5


def _get_llm() -> ChatOpenAI:
    """创建 LangChain LLM 客户端（DeepSeek OpenAI 兼容）。"""
    return ChatOpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        model=DEEPSEEK_MODEL,
        temperature=0.7,
    )


def build_blog_context(title: str, summary: Optional[str], body: str) -> str:
    """构建博客正文上下文文本，注入 agent 状态。"""
    parts = [f"# {title}"]
    if summary:
        parts.append(f"摘要：{summary}")
    parts.append("正文：\n" + body[:BLOG_CONTEXT_MAX_CHARS])
    return "\n\n".join(parts)


# ── 意图检测 ──────────────────────────────────────────────────────────

INTENT_DETECT_SYSTEM_PROMPT_TEMPLATE = """你是一个意图分类助手。请判断用户最后一条消息的意图。

本次可选意图：{scope_desc}

- "theme"：与 App 主题、颜色、样式、外观、界面风格、配色相关的请求或讨论
- "post_edit"：要求修改博客的标题、摘要或正文内容
- "chat"：普通聊天、问答、咨询、RAG 知识问答等其他所有情况

只输出分类结果和置信度，intent 必须是可选意图之一。"""


def intent_detect_node(state: AgentState) -> AgentState:
    """节点 1：意图检测（scope 化）。

    从对话历史中判断用户意图，intent 值域受 intent_scope 约束。
    """
    messages = state["messages"]
    intent_scope = state.get("intent_scope") or ["chat", "theme"]
    llm = _get_llm()

    system_prompt = INTENT_DETECT_SYSTEM_PROMPT_TEMPLATE.format(
        scope_desc="、".join(intent_scope)
    )

    last_user_messages = [m for m in messages if isinstance(m, HumanMessage)][-3:]
    detect_messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(
            content="请判断以下用户消息的意图：\n\n"
            + "\n".join(f"用户：{m.content}" for m in last_user_messages)
        ),
    ]

    structured_llm = llm.with_structured_output(IntentDetection)
    result: IntentDetection = structured_llm.invoke(detect_messages)

    intent = result.intent
    if intent not in intent_scope:
        intent = "chat"

    return {
        **state,
        "intent": intent,
    }


# ── 主题生成 ──────────────────────────────────────────────────────────

THEME_GENERATE_SYSTEM_PROMPT = """你是一位专业的 App UI 配色设计师。用户想用自然语言描述来定制 App 的颜色主题。

请根据用户的描述，生成一套协调的配色方案。你只需要输出用户提到或需要跟随主色调整的颜色，不需要输出所有 21 个键。

颜色键说明：
- primary: 主题主色（按钮、强调色、选中色）
- primaryText: 主色上的文字颜色
- background: 页面背景色
- surface: 卡片/表面背景色
- surfaceSoft: 软表面背景色（比 surface 稍浅/深）
- surfaceWarm: 暖色调表面
- surfacePink: 粉色表面背景（用于装饰性卡片）
- surfacePinkStrong: 深粉表面
- text: 主要文字颜色
- textMuted: 次要文字颜色
- textSubtle: 辅助文字颜色（更浅）
- border: 边框颜色
- borderStrong: 深边框
- danger: 危险/错误色
- dangerText: 危险色上的文字
- warning: 警告背景色
- warningBorder: 警告边框
- warningText: 警告文字
- overlay: 遮罩层（rgba 格式）
- imageOverlay: 图片遮罩（rgba 格式）
- white: 纯白/高亮白色

要求：
1. 配色要协调、专业、符合现代审美
2. 确保文字和背景有足够对比度，保证可读性
3. 如果用户只说一个主色调，请围绕它派生出 surface、text 等相关颜色
4. 只输出需要修改的键，保持最小变更原则
5. 颜色值使用 6 位 hex 格式（如 #2563eb），overlay 和 imageOverlay 可用 rgba

同时用中文写一段自然语言描述，向用户解释这套配色方案（2-3 句话，亲切易懂）。"""


def generate_theme_node(state: AgentState) -> AgentState:
    """节点：生成主题方案。"""
    messages = state["messages"]
    current_mode = state.get("current_mode", "light")
    existing = state.get("existing_custom_theme") or {}

    llm = _get_llm()
    structured_llm = llm.with_structured_output(ThemeProposal)

    context_info = f"当前主题模式：{current_mode}\n"
    if existing:
        context_info += f"用户已有的自定义颜色：{json.dumps(existing, ensure_ascii=False)}\n"
    else:
        context_info += "用户尚未自定义任何颜色，使用默认主题。\n"

    recent_messages = messages[-8:]
    theme_messages: list = [
        SystemMessage(content=THEME_GENERATE_SYSTEM_PROMPT),
        HumanMessage(content=context_info + "\n请根据用户的要求生成配色方案。"),
    ]
    for msg in recent_messages:
        if isinstance(msg, HumanMessage):
            theme_messages.append(HumanMessage(content=msg.content))
        elif isinstance(msg, AIMessage):
            theme_messages.append(AIMessage(content=msg.content))

    result: ThemeProposal = structured_llm.invoke(theme_messages)

    from ..schemas import VALID_THEME_COLOR_KEYS

    valid_colors = {k: v for k, v in result.colors.items() if k in VALID_THEME_COLOR_KEYS}

    return {
        **state,
        "theme_proposal": valid_colors,
        "theme_description": result.description,
        "final_text": result.description,
    }


# ── 博客编辑提案 ──────────────────────────────────────────────────────

BLOG_EDIT_SYSTEM_PROMPT = """你是一个博客内容编辑助手。用户会提出修改要求，你需要输出修改后的完整内容。

当前博客内容：

{blog_context}

要求：
1. 根据用户要求修改博客，输出修改后的完整标题、摘要和正文
2. 正文保持 Markdown 格式，尽量保留原文结构，只改动用户要求的部分
3. 摘要用一句话概括正文内容，可为空
4. 用中文写一段 2-3 句的修改说明，说明你做了哪些改动

只输出结构化结果。"""


def post_edit_proposal_node(state: AgentState) -> AgentState:
    """节点：博客内容修改提案（从 blog_agent 迁入）。"""
    messages = state["messages"]
    blog_context = state.get("blog_context") or ""

    llm = _get_llm()
    proposal_llm = llm.with_structured_output(PostEditProposal)

    recent_messages = messages[-8:]
    edit_messages = [
        SystemMessage(content=BLOG_EDIT_SYSTEM_PROMPT.format(blog_context=blog_context)),
    ]
    for msg in recent_messages:
        if isinstance(msg, HumanMessage):
            edit_messages.append(HumanMessage(content=msg.content))
        elif isinstance(msg, AIMessage):
            edit_messages.append(AIMessage(content=msg.content))

    proposal: PostEditProposal = proposal_llm.invoke(edit_messages)

    return {
        **state,
        "post_edit_proposal": {
            "title": proposal.title,
            "summary": proposal.summary,
            "body": proposal.body,
            "description": proposal.description,
        },
        "final_text": proposal.description,
    }


# ── 工具循环（chat 分支） ─────────────────────────────────────────────

CHAT_SYSTEM_PROMPT_TEMPLATE = """你是一个知识博客 App 的 AI 助手，擅长回答用户问题。

{rag_context}

请用中文回答用户问题。如果提供了参考资料，请优先基于资料回答；如果资料不足，请诚实说明，再基于你的知识补充。"""

TOOL_GUIDANCE = """

你可以调用工具检索站内的博客内容、查看文章全文或用户的收藏。
检索范围包括：全站、指定作者的知识库（author 传用户名）、我发布的文章（only_mine）、
我的收藏（only_favorites，可配合 days 按时间过滤）。
当已有上下文足以回答时请直接回答，不要为了调用而调用工具。"""


def _serialize_tool_result(value: Any) -> str:
    """将工具返回值序列化为字符串并截断。"""
    if isinstance(value, str):
        text = value
    else:
        try:
            text = json.dumps(value, ensure_ascii=False, default=str)
        except Exception:
            text = str(value)
    if len(text) > TOOL_RESULT_MAX_CHARS:
        text = text[:TOOL_RESULT_MAX_CHARS] + "...[结果已截断]"
    return text


def make_agent_reason_node(tools: list):
    """构造 agent_reason 节点：绑定只读工具，决策是否调用工具或直接回答。"""

    def _build_system_prompt(state: AgentState) -> str:
        rag_context = state.get("rag_context") or "（当前没有检索到相关的站内博客内容，请基于你的知识回答。）"
        prompt = CHAT_SYSTEM_PROMPT_TEMPLATE.format(rag_context=rag_context)

        blog_context = state.get("blog_context")
        if blog_context:
            prompt += "\n\n当前正在阅读的博客内容：\n" + blog_context

        author_name = state.get("current_author_name")
        if author_name:
            prompt += (
                f'\n\n当前博客作者：{author_name}。'
                f'用户提到"当前作者/这位作者"时指该用户。'
            )

        user_name = state.get("current_user_name")
        if user_name:
            prompt += (
                f'\n\n当前登录用户（提问者）是：{user_name}。'
                f'用户提到"我/我的"（如"我的收藏""我发布的文章"）时指该用户。'
            )

        prompt += TOOL_GUIDANCE
        return prompt

    async def agent_reason_node(state: AgentState) -> AgentState:
        messages = state["messages"]
        tool_call_count = state.get("tool_call_count", 0)

        final_messages: list = [SystemMessage(content=_build_system_prompt(state))]
        for msg in messages:
            if isinstance(msg, (HumanMessage, AIMessage, ToolMessage)):
                final_messages.append(msg)

        if tool_call_count >= MAX_TOOL_ROUNDS:
            llm = _get_llm()
            response = await llm.ainvoke(
                final_messages
                + [HumanMessage(content="（系统提示：工具调用次数已达上限，请基于已有信息直接回答。）")]
            )
            return {
                **state,
                "messages": messages + [response],
                "final_text": response.content,
            }

        if tools:
            llm = _get_llm().bind_tools(tools)
        else:
            llm = _get_llm()
        response = await llm.ainvoke(final_messages)

        if getattr(response, "tool_calls", None):
            return {
                **state,
                "messages": messages + [response],
            }

        return {
            **state,
            "messages": messages + [response],
            "final_text": response.content,
        }

    return agent_reason_node


def make_tool_executor_node(tools: list):
    """构造 tool_executor 节点：执行上一条 AIMessage 的 tool_calls 并回填 ToolMessage。"""

    tool_map = {t.name: t for t in tools}

    async def tool_executor_node(state: AgentState) -> AgentState:
        messages = list(state["messages"])
        last = messages[-1] if messages else None
        if last is None or not getattr(last, "tool_calls", None):
            return state

        tool_call_count = state.get("tool_call_count", 0)
        result_messages: List[ToolMessage] = []

        for call in last.tool_calls:
            name = call.get("name")
            args = call.get("args") or {}
            tool_obj = tool_map.get(name)

            if tool_obj is None:
                content = f"错误：未知工具 {name}。"
            else:
                try:
                    raw = await asyncio.wait_for(
                        asyncio.to_thread(tool_obj.func, **args),
                        timeout=TOOL_TIMEOUT_SECONDS,
                    )
                    content = _serialize_tool_result(raw)
                except asyncio.TimeoutError:
                    content = f"工具 {name} 执行超时，请忽略该结果继续。"
                except Exception as exc:
                    content = f"工具 {name} 执行失败：{exc}"

            result_messages.append(
                ToolMessage(content=content, tool_call_id=call.get("id"))
            )

        return {
            **state,
            "messages": messages + result_messages,
            "tool_call_count": tool_call_count + 1,
        }

    return tool_executor_node


# ── 路由 ──────────────────────────────────────────────────────────────

def route_by_intent(state: AgentState) -> Literal["chat", "theme", "post_edit"]:
    """条件边：根据 intent 路由到对应节点。"""
    return state["intent"]


def route_after_reason(state: AgentState) -> Literal["tool_executor", "end"]:
    """条件边：agent_reason 后，有 tool_calls 则进入工具执行，否则结束。"""
    messages = state.get("messages") or []
    last = messages[-1] if messages else None
    if last is not None and getattr(last, "tool_calls", None):
        return "tool_executor"
    return "end"
