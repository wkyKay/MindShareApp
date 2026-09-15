"""Agent 工作流状态定义。"""

from typing import Any, Dict, List, Literal, Optional, TypedDict

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
    - intent_scope: 当前入口允许的意图集合
    - blog_context: /blog/stream 注入的博客正文上下文
    - current_author_id: /blog/stream 注入的当前博客作者 ID
    - current_author_name: 当前博客作者用户名（system prompt 与工具参数解析用）
    - current_user_id: 当前登录用户（提问者）ID
    - current_user_name: 当前登录用户用户名（system prompt 用于指代"我/我的"）
    - post_edit_proposal: post_edit 分支的结构化输出
    - tool_call_count: 工具循环轮次计数（上限保护）
    """

    messages: List[BaseMessage]
    intent: Literal["chat", "theme", "post_edit"]
    theme_proposal: Optional[Dict[str, str]]
    theme_description: Optional[str]
    rag_context: Optional[str]
    final_text: Optional[str]
    current_mode: Literal["light", "dark"]
    existing_custom_theme: Optional[Dict[str, str]]
    intent_scope: List[str]
    blog_context: Optional[str]
    current_author_id: Optional[int]
    current_author_name: Optional[str]
    current_user_id: Optional[int]
    current_user_name: Optional[str]
    post_edit_proposal: Optional[Dict[str, Any]]
    tool_call_count: int
