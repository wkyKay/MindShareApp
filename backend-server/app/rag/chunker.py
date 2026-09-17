"""文档切分层。

升级点：
- Markdown 结构感知切分（按标题层级）
- 句子级语义边界（句号/换行处断开）
- Overlap 重叠（防止边界信息丢失）
- 配置化参数（从环境变量读取）
"""

import re
from dataclasses import dataclass, field
from typing import List

from ..config import CHUNK_MAX_CHARS, CHUNK_OVERLAP_CHARS, CHUNK_TARGET_CHARS

HEADER_PATTERN = re.compile(r"^#{1,3}\s+.+$", re.MULTILINE)


@dataclass
class Chunk:
    """切分后的 chunk。"""
    content: str
    chunk_index: int
    metadata: dict = field(default_factory=dict)


def split_text(text: str) -> List[str]:
    """兼容旧接口：返回纯字符串列表。"""
    chunks = split_text_structured(text)
    return [c.content for c in chunks]


def split_text_structured(text: str) -> List[Chunk]:
    """将博客正文切分为 chunks，返回结构化信息。

    策略：
    1. 先按 Markdown 标题（# / ## / ###）切分大段
    2. 每个大段过长则按空行切段落
    3. 单个段落仍过长则按句子边界强制切分
    4. 相邻 chunk 重叠 overlap_chars 字符
    """
    text = text.strip()
    if not text:
        return []

    sections = _split_by_headers(text)
    all_chunks: List[Chunk] = []
    idx = 0
    for section in sections:
        section_chunks = _chunk_section(section.strip())
        for chunk_text in section_chunks:
            all_chunks.append(Chunk(content=chunk_text, chunk_index=idx))
            idx += 1

    return all_chunks


def _split_by_headers(text: str) -> List[str]:
    matches = list(HEADER_PATTERN.finditer(text))
    if not matches:
        return [text]

    sections: List[str] = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections.append(text[start:end])

    # 标题前的引导文本也算一段
    if matches and matches[0].start() > 0:
        sections.insert(0, text[: matches[0].start()])

    return sections


def _chunk_section(text: str) -> List[str]:
    """将单个 section 切分为多个 chunk，支持 overlap。"""
    text = text.strip()
    if not text:
        return []

    if len(text) <= CHUNK_MAX_CHARS:
        return [text]

    # 按空行切
    paragraphs = re.split(r"\n\s*\n", text)
    chunks: List[str] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(current) + len(para) + 2 <= CHUNK_TARGET_CHARS:
            current = (current + "\n\n" + para) if current else para
        else:
            if current:
                if len(current) > CHUNK_MAX_CHARS:
                    chunks.extend(_force_split(current))
                else:
                    chunks.append(current)
            current = para

    if current:
        if len(current) > CHUNK_MAX_CHARS:
            chunks.extend(_force_split(current))
        else:
            chunks.append(current)

    # 应用 overlap
    if CHUNK_OVERLAP_CHARS > 0 and len(chunks) > 1:
        chunks = _apply_overlap(chunks)

    return chunks


def _force_split(text: str) -> List[str]:
    """对单段超长文本按句子边界强制切分。"""
    # 按中文句号、英文句号、问号、感叹号、换行切分
    sentences = re.split(r"(?<=[。！？.!?\n])", text)
    chunks: List[str] = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) <= CHUNK_MAX_CHARS:
            current += sent
        else:
            if current.strip():
                chunks.append(current.strip())
            # 如果单句就超过 max，也要切（硬性截断）
            if len(sent) > CHUNK_MAX_CHARS:
                for i in range(0, len(sent), CHUNK_MAX_CHARS):
                    piece = sent[i : i + CHUNK_MAX_CHARS]
                    if piece.strip():
                        chunks.append(piece.strip())
                current = ""
            else:
                current = sent
    if current.strip():
        chunks.append(current.strip())
    return chunks


def _apply_overlap(chunks: List[str]) -> List[str]:
    """为相邻 chunk 添加重叠部分。

    从后一个 chunk 的开头取 overlap_chars 字符，追加到前一个 chunk 的末尾。
    注意：保证重叠是完整语义单位（句子级别），但为简单起见先做字符级。
    """
    overlapped: List[str] = []
    for i, chunk in enumerate(chunks):
        if i == 0:
            # 第一个 chunk，只向后追加下一个的前缀
            next_chunk = chunks[i + 1] if i + 1 < len(chunks) else ""
            overlap_text = next_chunk[:CHUNK_OVERLAP_CHARS] if next_chunk else ""
            overlapped.append(chunk + overlap_text if overlap_text else chunk)
        else:
            # 从上个 chunk 的末尾取 overlap
            prev_chunk = chunks[i - 1]
            overlap_text = prev_chunk[-CHUNK_OVERLAP_CHARS:] if prev_chunk else ""
            next_chunk = chunks[i + 1] if i + 1 < len(chunks) else ""
            next_overlap = next_chunk[:CHUNK_OVERLAP_CHARS] if next_chunk else ""
            overlapped.append(overlap_text + chunk + next_overlap)
    return overlapped
