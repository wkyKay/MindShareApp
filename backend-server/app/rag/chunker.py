import re
from typing import List


CHUNK_MAX_CHARS = 800
CHUNK_TARGET_CHARS = 400
HEADER_PATTERN = re.compile(r"^#{1,3}\s+.+$", re.MULTILINE)


def split_text(text: str) -> List[str]:
    """将博客正文切分为 chunks。

    策略：
    1. 先按 Markdown 标题（# / ## / ###）切分大段
    2. 每个大段过长则按空行切段落
    3. 单个段落仍过长则按句号/换行强制切分
    """
    text = text.strip()
    if not text:
        return []

    sections = _split_by_headers(text)
    chunks: List[str] = []
    for section in sections:
        chunks.extend(_chunk_section(section.strip()))
    return chunks


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
        if len(current) + len(para) + 2 <= CHUNK_MAX_CHARS:
            current = (current + "\n\n" + para) if current else para
        else:
            if current:
                # 单个段落超长则强制切分
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

    return chunks


def _force_split(text: str) -> List[str]:
    """对单段超长文本按句号/换行强制切分。"""
    sentences = re.split(r"(?<=[。！？\n])", text)
    chunks: List[str] = []
    current = ""
    for sent in sentences:
        if len(current) + len(sent) <= CHUNK_MAX_CHARS:
            current += sent
        else:
            if current.strip():
                chunks.append(current.strip())
            current = sent
    if current.strip():
        chunks.append(current.strip())
    return chunks
