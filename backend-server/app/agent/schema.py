"""Agent 结构化输出 Pydantic 模型。"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class IntentDetection(BaseModel):
    """用户意图分类结果。"""

    intent: Literal["chat", "theme", "post_edit"] = Field(
        description="用户意图：chat 表示普通聊天或问答，theme 表示主题/样式定制相关，post_edit 表示要修改博客标题、摘要或正文"
    )
    confidence: float = Field(description="置信度 0-1")


class PostEditProposal(BaseModel):
    """博客内容修改提案。"""

    title: str = Field(description="修改后的完整标题")
    summary: Optional[str] = Field(default=None, description="修改后的摘要，可为空")
    body: str = Field(description="修改后的完整正文 Markdown")
    description: str = Field(description="用中文简述本次修改的要点，2-3 句")


class ThemeProposal(BaseModel):
    """主题定制方案。只包含用户提到需要修改的颜色键。"""

    description: str = Field(description="用自然语言描述这套主题方案，简洁易懂，面向用户")
    colors: dict[str, str] = Field(
        description=(
            "颜色键值对。键必须是以下之一：background、surface、surfaceSoft、"
            "surfaceWarm、surfacePink、surfacePinkStrong、text、textMuted、textSubtle、"
            "border、borderStrong、primary、primaryText、danger、dangerText、warning、"
            "warningBorder、warningText、overlay、imageOverlay、white。"
            "值为合法的十六进制颜色（如 #ff0000）。"
            "只输出用户明确要求修改或你认为需要跟随主色调整的颜色，不要输出全部 21 个。"
        )
    )
