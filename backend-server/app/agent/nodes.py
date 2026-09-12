"""Agent 工作流节点实现。"""

import json
from typing import Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from ..config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
from .schema import IntentDetection, ThemeProposal
from .state import AgentState


def _get_llm() -> ChatOpenAI:
    """创建 LangChain LLM 客户端（DeepSeek OpenAI 兼容）。"""
    return ChatOpenAI(
        api_key=DEEPSEEK_API_KEY,
        base_url=DEEPSEEK_BASE_URL,
        model=DEEPSEEK_MODEL,
        temperature=0.7,
    )


INTENT_DETECT_SYSTEM_PROMPT = """你是一个意图分类助手。请判断用户最后一条消息的意图是：
- "theme"：与 App 主题、颜色、样式、外观、界面风格、配色相关的请求或讨论
- "chat"：普通聊天、问答、咨询、RAG 知识问答等其他所有情况

只输出分类结果和置信度。"""


def intent_detect_node(state: AgentState) -> AgentState:
    """节点 1：意图检测。

    从对话历史中判断用户意图是普通聊天还是主题定制。
    """
    messages = state["messages"]
    llm = _get_llm()

    # 构建意图检测的消息：系统提示 + 最近几条对话
    last_user_messages = [m for m in messages if isinstance(m, HumanMessage)][-3:]
    detect_messages = [
        SystemMessage(content=INTENT_DETECT_SYSTEM_PROMPT),
        HumanMessage(
            content="请判断以下用户消息的意图：\n\n"
            + "\n".join(f"用户：{m.content}" for m in last_user_messages)
        ),
    ]

    structured_llm = llm.with_structured_output(IntentDetection)
    result: IntentDetection = structured_llm.invoke(detect_messages)

    return {
        **state,
        "intent": result.intent,
    }


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
    """节点 2：生成主题方案。

    调用 LLM 结构化输出 ThemeProposal，包含描述和颜色字典。
    """
    messages = state["messages"]
    current_mode = state.get("current_mode", "light")
    existing = state.get("existing_custom_theme") or {}

    llm = _get_llm()
    structured_llm = llm.with_structured_output(ThemeProposal)

    # 加入上下文：当前模式和已有自定义主题
    context_info = f"当前主题模式：{current_mode}\n"
    if existing:
        context_info += f"用户已有的自定义颜色：{json.dumps(existing, ensure_ascii=False)}\n"
    else:
        context_info += "用户尚未自定义任何颜色，使用默认主题。\n"

    # 只保留最近的用户消息和助手消息，控制 token
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

    # 过滤合法颜色键（防御性校验）
    from ..schemas import VALID_THEME_COLOR_KEYS

    valid_colors = {k: v for k, v in result.colors.items() if k in VALID_THEME_COLOR_KEYS}

    return {
        **state,
        "theme_proposal": valid_colors,
        "theme_description": result.description,
        "final_text": result.description,
    }


CHAT_SYSTEM_PROMPT_TEMPLATE = """你是一个知识博客 App 的 AI 助手，擅长回答用户问题。

{rag_context}

请用中文回答用户问题。如果提供了参考资料，请优先基于资料回答；如果资料不足，请诚实说明，再基于你的知识补充。"""


def chat_response_node(state: AgentState) -> AgentState:
    """节点 3：普通聊天回复（带 RAG 上下文）。

    注意：流式输出由调用方直接调用 LLM stream 完成，
    此节点只负责构建最终消息并更新状态（用于状态流转记录）。
    实际的流式输出在 graph.py 的 run_agent_stream 中处理。
    """
    # 此节点的实际流式输出由 run_agent_stream 直接处理
    # 这里只返回状态占位
    return {
        **state,
        "intent": "chat",
    }


def route_by_intent(state: AgentState) -> Literal["chat", "theme"]:
    """条件边：根据 intent 路由到对应节点。"""
    return state["intent"]
