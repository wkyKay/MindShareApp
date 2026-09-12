"""Agent 工作流状态定义。"""

from typing import Literal, Optional, TypedDict

from langchain_core.messages import BaseMessage


class AgentState(TypedDict, total=False):
    """Agent 工作流共享状态。

    - messages: 完整对话历史（LangChain Message 格式）
    - intent: 意图分类结果
    - theme_proposal: 生成的主题方案（结构化数据）
    - theme_description: 主题方案的自然语言描述
    - rag_context: RAG 检索到的上下文文本
    - final_text: 最终要流式输出给用户的文本（chat 分支的回复或 theme 分支的描述）
    - current_mode: 当前激活的主题模式（light/dark），用于 theme 生成参考
    - existing_custom_theme: 用户已有的自定义主题（增量参考）
    """

    messages: list[BaseMessage]
    intent: Literal["chat", "theme"]
    theme_proposal: Optional[dict[str, str]]
    theme_description: Optional[str]
    rag_context: Optional[str]
    final_text: Optional[str]
    current_mode: Literal["light", "dark"]
    existing_custom_theme: Optional[dict[str, str]]
