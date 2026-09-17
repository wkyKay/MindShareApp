"""测试上下文构建与引用溯源（FUNC-03 系列）。"""

from dataclasses import dataclass

import pytest

from app.rag.context_builder import build_context, BuildContextResult, Reference


@dataclass
class FakeChunk:
    """模拟 Chunk 数据对象。"""
    content: str
    post_id: int = 0
    chunk_index: int = 0


@dataclass
class FakeRetrievedChunk:
    """模拟 RetrievedChunk。"""
    chunk: FakeChunk
    score: float = 0.0
    post_title: str = ""
    rerank_score: float = None
    references: dict = None


def _make_fake(post_id, chunk_index, content, title="测试文章"):
    return FakeRetrievedChunk(
        chunk=FakeChunk(content=content, post_id=post_id, chunk_index=chunk_index),
        score=0.9,
        post_title=title,
    )


class TestContextBuilder:
    """上下文构建测试用例。"""

    def test_build_context_format(self):
        """验证输出格式「【资料 n】来源：《标题》（第 N 段）」。"""
        chunks = [
            _make_fake(1, 0, "这是第一段内容", title="测试标题"),
        ]
        result = build_context(chunks)
        assert isinstance(result, BuildContextResult)
        assert "【资料 1】" in result.context_text
        assert "来源：" in result.context_text
        assert "《测试标题》" in result.context_text
        assert "第 1 段" in result.context_text

    def test_build_context_references(self):
        """references 列表与 chunk 数对应，含 post_id, title, chunk_index, content。"""
        chunks = [
            _make_fake(1, 0, "内容A", title="文章A"),
            _make_fake(2, 1, "内容B", title="文章B"),
            _make_fake(3, 2, "内容C", title="文章C"),
        ]
        result = build_context(chunks)
        assert len(result.references) == 3
        for ref in result.references:
            assert isinstance(ref, Reference)
            assert hasattr(ref, "post_id")
            assert hasattr(ref, "post_title")
            assert hasattr(ref, "chunk_index")
            assert hasattr(ref, "content")
            assert hasattr(ref, "score")

        assert result.references[0].post_id == 1
        assert result.references[0].post_title == "文章A"
        assert result.references[0].chunk_index == 0
        assert result.references[0].content == "内容A"

    def test_max_chars_truncation(self):
        """超过 max_chars 时截断。"""
        chunks = [
            _make_fake(1, i, f"内容{i} " * 100, title=f"文章{i}")
            for i in range(10)
        ]
        result = build_context(chunks, max_chars=500)
        assert len(result.context_text) <= 600  # 允许少量头部开销
        assert len(result.references) < 10

    def test_empty_chunks(self):
        """空 chunks 返回空上下文和空引用。"""
        result = build_context([])
        assert isinstance(result, BuildContextResult)
        assert result.references == []
        assert "未检索到相关" in result.context_text

    def test_single_chunk(self):
        """单 chunk 正确格式化。"""
        chunks = [_make_fake(42, 3, "唯一的内容", title="独一文章")]
        result = build_context(chunks)
        assert len(result.references) == 1
        assert "【资料 1】" in result.context_text
        assert "《独一文章》" in result.context_text
        assert "第 4 段" in result.context_text  # chunk_index=3 → 第 4 段
        assert result.references[0].post_id == 42
        assert result.references[0].chunk_index == 3
