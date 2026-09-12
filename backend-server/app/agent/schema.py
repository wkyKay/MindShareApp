"""Agent 结构化输出 Pydantic 模型。"""

from typing import Literal

from pydantic import BaseModel, Field


class IntentDetection(BaseModel):
    """用户意图分类结果。"""

    intent: Literal["chat", "theme"] = Field(
        description="用户意图：chat 表示普通聊天或问答，theme 表示主题/样式定制相关"
    )
    confidence: float = Field(description="置信度 0-1")


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
