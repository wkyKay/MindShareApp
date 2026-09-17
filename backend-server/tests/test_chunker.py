"""测试 Chunker 模块（FUNC-01 系列）。"""

import pytest
from unittest.mock import patch

from app.rag.chunker import split_text, split_text_structured, Chunk


class TestChunker:
    """Chunker 模块测试用例。"""

    def test_split_text_basic(self):
        """普通文本切分，chunk_size=100, overlap=20。"""
        text = "。".join([f"第{i}段这是一段测试内容" for i in range(50)]) + "。"
        with patch("app.rag.chunker.CHUNK_MAX_CHARS", 100), \
             patch("app.rag.chunker.CHUNK_OVERLAP_CHARS", 20), \
             patch("app.rag.chunker.CHUNK_TARGET_CHARS", 50):
            result = split_text(text)
            assert isinstance(result, list)
            assert len(result) >= 2
            for chunk in result:
                assert isinstance(chunk, str)

    def test_split_text_structured(self):
        """验证结构化输出包含 text, chunk_index 等字段。"""
        text = "第一段内容。\n\n第二段内容。"
        with patch("app.rag.chunker.CHUNK_MAX_CHARS", 50), \
             patch("app.rag.chunker.CHUNK_OVERLAP_CHARS", 5), \
             patch("app.rag.chunker.CHUNK_TARGET_CHARS", 20):
            result = split_text_structured(text)
            assert isinstance(result, list)
            assert len(result) > 0
            for chunk in result:
                assert isinstance(chunk, Chunk)
                assert hasattr(chunk, "content")
                assert hasattr(chunk, "chunk_index")
                assert hasattr(chunk, "metadata")
                assert isinstance(chunk.content, str)
                assert isinstance(chunk.chunk_index, int)

    def test_overlap_applied(self):
        """验证相邻 chunk 之间有重叠字符。"""
        text = "A" * 100 + "。" + "B" * 100 + "。" + "C" * 100
        with patch("app.rag.chunker.CHUNK_MAX_CHARS", 110), \
             patch("app.rag.chunker.CHUNK_OVERLAP_CHARS", 20), \
             patch("app.rag.chunker.CHUNK_TARGET_CHARS", 60):
            result = split_text_structured(text)
            assert len(result) >= 2
            for i in range(1, len(result)):
                prev = result[i - 1].content
                curr = result[i].content
                overlap_text = prev[-20:]
                assert len(overlap_text) > 0

    def test_short_text_no_split(self):
        """短文本不切分。"""
        text = "这是一段很短的文本。"
        with patch("app.rag.chunker.CHUNK_MAX_CHARS", 500), \
             patch("app.rag.chunker.CHUNK_OVERLAP_CHARS", 10), \
             patch("app.rag.chunker.CHUNK_TARGET_CHARS", 200):
            result = split_text(text)
            assert len(result) == 1
            assert result[0] == text

    def test_empty_text(self):
        """空文本返回空列表。"""
        result = split_text("")
        assert result == []

        result2 = split_text("   ")
        assert result2 == []

    def test_backward_compat(self):
        """旧接口 split_text(text) 仍返回 List[str]。"""
        text = "测试内容。"
        result = split_text(text)
        assert isinstance(result, list)
        assert all(isinstance(item, str) for item in result)
