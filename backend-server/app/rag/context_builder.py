"""上下文构建层。

负责将检索结果组装成结构化 prompt，并标注引用信息。
输出格式与引用溯源兼容。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class Reference:
    """引用信息。"""
    post_id: int
    post_title: str
    chunk_index: int
    content: str
    score: float = 0.0


@dataclass
class BuildContextResult:
    """上下文构建结果。"""
    context_text: str
    references: List[Reference] = field(default_factory=list)


def build_context(chunks: list, max_chars: int = 6000) -> BuildContextResult:
    """将检索结果组装为带引用标记的上下文文本。

    chunks: RetrievedChunk 列表（按相关度排序）
    max_chars: 上下文最大字符数（防止超出 token 限制）
    """
    references: List[Reference] = []
    parts: list[str] = []
    total_chars = 0

    for i, chunk in enumerate(chunks, 1):
        # 提取引用信息
        ref = Reference(
            post_id=getattr(chunk.chunk, "post_id", 0),
            post_title=getattr(chunk, "post_title", ""),
            chunk_index=getattr(chunk.chunk, "chunk_index", 0),
            content=chunk.chunk.content,
            score=getattr(chunk, "score", 0.0),
        )

        # 构建段落
        source_text = f"【资料 {i}】来源：《{ref.post_title}》（第 {ref.chunk_index + 1} 段）"
        content_text = ref.content

        entry = f"{source_text}\n{content_text}\n"

        # 检查长度
        if total_chars + len(entry) > max_chars:
            # 截断
            remaining = max_chars - total_chars
            if remaining > 50:
                parts.append(entry[:remaining] + "\n...[内容已截断]")
                references.append(ref)
            break

        parts.append(entry)
        references.append(ref)
        total_chars += len(entry)

    if parts:
        header = "以下是与用户问题相关的站内博客内容，请参考这些内容回答。\n" \
                 "请在回答中用 [1] [2] 等数字标注引用来源，与上面的资料编号对应。\n\n"
        context_text = header + "\n".join(parts)
    else:
        context_text = "（未检索到相关的站内博客内容，请基于你的知识回答。）"

    return BuildContextResult(
        context_text=context_text,
        references=references,
    )
