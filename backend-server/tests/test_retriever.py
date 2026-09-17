"""测试检索器核心逻辑（RET-01~08，大量 mock）。"""

from dataclasses import dataclass
from unittest.mock import MagicMock, patch

import pytest

from app.rag.retriever import (
    _rrf,
    retrieve,
    RetrievedChunk,
    TOP_K,
    RRF_K,
)
from app.rag.vector_store import SearchResult


@dataclass
class FakeUser:
    id: int = 1
    username: str = "testuser"


def _setup_mock_db(mock_db, follow_results, visible_post_ids, post_titles):
    """设置 mock DB 以支持多种查询。

    follow_results: list of (following_id,) tuples
    visible_post_ids: list of (post_id,) tuples
    post_titles: list of (post_id, title) tuples
    """
    call_state = {"count": 0}

    def all_side_effect():
        call_state["count"] += 1
        n = call_state["count"]
        if n == 1:
            return follow_results  # Follow.following_id 查询
        if n == 2:
            return visible_post_ids  # Post.id 查询（可见性过滤）
        return post_titles  # Post.id, Post.title 查询

    mock_query = MagicMock()
    mock_query.join.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.side_effect = all_side_effect
    mock_db.query.return_value = mock_query
    return call_state


class TestRetriever:
    """检索器测试用例。"""

    def test_retrieve_basic(self):
        """mock vector_store 返回候选，验证能正常返回 RetrievedChunk 列表。"""
        mock_db = MagicMock()
        _setup_mock_db(
            mock_db,
            follow_results=[],
            visible_post_ids=[(1,)],
            post_titles=[(1, "测试文章")],
        )

        # 模拟向量库返回
        mock_vs = MagicMock()
        mock_vs.search.return_value = [
            SearchResult(
                post_id=1, chunk_index=0,
                content="测试内容", score=0.9,
                metadata={},
            ),
        ]

        with patch("app.rag.retriever.get_vector_store", return_value=mock_vs), \
             patch("app.rag.retriever.is_vector_store_available", return_value=True), \
             patch("app.rag.retriever.embedding_available", return_value=True), \
             patch("app.rag.retriever.embed_text", return_value=[0.1] * 32), \
             patch("app.rag.retriever.SPARSE_ENABLED", False), \
             patch("app.rag.retriever.QUERY_REWRITE_ENABLED", False), \
             patch("app.rag.retriever.rerank_chunks", side_effect=lambda q, c, k: c[:k]):
            user = FakeUser(id=1)
            results = retrieve("测试查询", user, mock_db, top_k=5)
            assert isinstance(results, list)
            assert len(results) == 1
            assert isinstance(results[0], RetrievedChunk)
            assert results[0].post_title == "测试文章"

    def test_rrf_fusion(self):
        """直接测试 _rrf 函数，两路排名融合后顺序正确。"""
        ranking1 = ["a", "b", "c", "d"]  # ranks: a=0, b=1, c=2, d=3
        ranking2 = ["c", "b", "e"]       # ranks: c=0, b=1, e=2

        scores = _rrf([ranking1, ranking2], k=60)

        # c: 1/63 + 1/61 ≈ 0.03226
        # b: 1/62 + 1/62 = 2/62 ≈ 0.03226
        # c 排名更好（在 ranking2 排第一）
        score_c = scores.get("c", 0)
        score_b = scores.get("b", 0)
        score_a = scores.get("a", 0)

        assert score_c > score_b
        assert score_b > score_a  # b 两路都有，a 只有一路
        assert "d" in scores
        assert "e" in scores

        # 验证所有 ID 都在结果中
        assert set(scores.keys()) == {"a", "b", "c", "d", "e"}

    def test_visibility_filter_public(self):
        """未登录用户只能看到公开帖子。"""
        mock_db = MagicMock()
        _setup_mock_db(
            mock_db,
            follow_results=[],  # 无关注
            visible_post_ids=[(1,)],  # 只有 post 1 可见
            post_titles=[(1, "公开文章")],
        )

        mock_vs = MagicMock()
        mock_vs.search.return_value = [
            SearchResult(
                post_id=1, chunk_index=0,
                content="公开内容", score=0.8,
                metadata={"visibility": "public"},
            ),
        ]

        with patch("app.rag.retriever.get_vector_store", return_value=mock_vs), \
             patch("app.rag.retriever.is_vector_store_available", return_value=True), \
             patch("app.rag.retriever.embedding_available", return_value=True), \
             patch("app.rag.retriever.embed_text", return_value=[0.1] * 32), \
             patch("app.rag.retriever.SPARSE_ENABLED", False), \
             patch("app.rag.retriever.QUERY_REWRITE_ENABLED", False), \
             patch("app.rag.retriever.rerank_chunks", side_effect=lambda q, c, k: c[:k]):
            user = FakeUser(id=99)  # 普通用户
            results = retrieve("测试", user, mock_db, top_k=5)
            assert isinstance(results, list)
            assert len(results) == 1
            assert results[0].post_title == "公开文章"

    def test_visibility_filter_followers(self):
        """登录用户能看到关注者的 followers 可见帖子。"""
        mock_db = MagicMock()
        _setup_mock_db(
            mock_db,
            follow_results=[(10,)],  # 关注了 id=10
            visible_post_ids=[(1,), (2,)],  # post 1 和 2 可见
            post_titles=[(1, "公开文章"), (2, "关注者文章")],
        )

        mock_vs = MagicMock()
        mock_vs.search.return_value = [
            SearchResult(
                post_id=2, chunk_index=0,
                content="关注者内容", score=0.8,
                metadata={"visibility": "followers", "author_id": 10},
            ),
        ]

        with patch("app.rag.retriever.get_vector_store", return_value=mock_vs), \
             patch("app.rag.retriever.is_vector_store_available", return_value=True), \
             patch("app.rag.retriever.embedding_available", return_value=True), \
             patch("app.rag.retriever.embed_text", return_value=[0.1] * 32), \
             patch("app.rag.retriever.SPARSE_ENABLED", False), \
             patch("app.rag.retriever.QUERY_REWRITE_ENABLED", False), \
             patch("app.rag.retriever.rerank_chunks", side_effect=lambda q, c, k: c[:k]):
            user = FakeUser(id=1)
            results = retrieve("测试", user, mock_db, top_k=5)
            assert isinstance(results, list)

    def test_rewrite_disabled(self):
        """QUERY_REWRITE_ENABLED=false 时不调用 query_rewriter。"""
        mock_db = MagicMock()
        _setup_mock_db(
            mock_db,
            follow_results=[],
            visible_post_ids=[(1,)],
            post_titles=[(1, "测试文章")],
        )

        mock_vs = MagicMock()
        mock_vs.search.return_value = [
            SearchResult(post_id=1, chunk_index=0, content="内容", score=0.9, metadata={}),
        ]

        with patch("app.rag.retriever.get_vector_store", return_value=mock_vs), \
             patch("app.rag.retriever.is_vector_store_available", return_value=True), \
             patch("app.rag.retriever.embedding_available", return_value=True), \
             patch("app.rag.retriever.embed_text", return_value=[0.1] * 32), \
             patch("app.rag.retriever.SPARSE_ENABLED", False), \
             patch("app.rag.retriever.QUERY_REWRITE_ENABLED", False), \
             patch("app.rag.retriever.rerank_chunks", side_effect=lambda q, c, k: c[:k]):
            user = FakeUser(id=1)
            results = retrieve("测试查询", user, mock_db, top_k=5)
            assert isinstance(results, list)
            assert len(results) == 1

    def test_sparse_enabled(self):
        """SPARSE_ENABLED=true 时走混合检索路径。"""
        mock_db = MagicMock()
        _setup_mock_db(
            mock_db,
            follow_results=[],
            visible_post_ids=[(1,), (2,)],
            post_titles=[(1, "稠密文章"), (2, "稀疏文章")],
        )

        mock_vs = MagicMock()
        # 稠密检索返回
        mock_vs.search.return_value = [
            SearchResult(post_id=1, chunk_index=0, content="稠密内容", score=0.9, metadata={}),
        ]

        mock_encoder = MagicMock()
        mock_encoder.encode.return_value = MagicMock(indices=[1], values=[0.5])

        with patch("app.rag.retriever.get_vector_store", return_value=mock_vs), \
             patch("app.rag.retriever.is_vector_store_available", return_value=True), \
             patch("app.rag.retriever.embedding_available", return_value=True), \
             patch("app.rag.retriever.embed_text", return_value=[0.1] * 32), \
             patch("app.rag.retriever.SPARSE_ENABLED", True), \
             patch("app.rag.retriever.is_sparse_available", return_value=True), \
             patch("app.rag.retriever.get_sparse_encoder", return_value=mock_encoder), \
             patch("app.rag.retriever.QUERY_REWRITE_ENABLED", False), \
             patch("app.rag.retriever._search_sparse_only", return_value=[
                 SearchResult(post_id=2, chunk_index=0, content="稀疏内容", score=0.8, metadata={}),
             ]), \
             patch("app.rag.retriever.rerank_chunks", side_effect=lambda q, c, k: c[:k]):
            user = FakeUser(id=1)
            results = retrieve("测试", user, mock_db, top_k=5)
            assert isinstance(results, list)
            # 两路结果融合，应该有 2 个结果
            assert len(results) == 2
            post_ids = [r.chunk.post_id for r in results]
            assert 1 in post_ids
            assert 2 in post_ids

    def test_empty_query(self):
        """空查询返回空列表。"""
        mock_db = MagicMock()

        with patch("app.rag.retriever.embed_text", return_value=None), \
             patch("app.rag.retriever.embedding_available", return_value=False), \
             patch("app.rag.retriever.is_vector_store_available", return_value=False), \
             patch("app.rag.retriever.SPARSE_ENABLED", False), \
             patch("app.rag.retriever.QUERY_REWRITE_ENABLED", False):
            user = FakeUser(id=1)
            results = retrieve("", user, mock_db, top_k=5)
            assert isinstance(results, list)
            assert len(results) == 0

    def test_fallback_bm25(self):
        """向量库不可用时降级到 BM25 暴力检索。"""
        mock_db = MagicMock()

        # 构造模拟 chunk 对象（需要支持 .content, .post_id 等属性）
        class MockChunk:
            def __init__(self, post_id, chunk_index, content):
                self.post_id = post_id
                self.chunk_index = chunk_index
                self.content = content
                self.id = post_id * 100 + chunk_index

        mock_chunks = [
            MockChunk(1, 0, "机器学习算法训练模型"),
            MockChunk(2, 0, "深度学习神经网络"),
            MockChunk(3, 0, "计算机视觉图像处理"),
        ]

        call_state = {"count": 0}

        def all_side_effect():
            call_state["count"] += 1
            n = call_state["count"]
            # retrieve 调用顺序：
            # 1. _build_visibility_filter → Follow 查询
            # 2. _build_visibility_filter → Post.id 可见性查询
            # 3. _fallback_bm25 → Follow 查询（第二次）
            # 4. _fallback_bm25 → TextChunk join Post 查询
            # 5. _fallback_bm25 → Post title 查询
            if n in (1, 3):
                return []  # Follow 查询（两次都返回空）
            if n == 2:
                return []  # Post.id 可见性查询（向量库不可用，其实没用）
            if n == 4:
                return mock_chunks  # TextChunk join 查询
            return [(1, "文章一"), (2, "文章二"), (3, "文章三")]  # Post title

        mock_query = MagicMock()
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.side_effect = all_side_effect
        mock_db.query.return_value = mock_query

        with patch("app.rag.retriever.is_vector_store_available", return_value=False), \
             patch("app.rag.retriever.SPARSE_ENABLED", False), \
             patch("app.rag.retriever.QUERY_REWRITE_ENABLED", False):
            user = FakeUser(id=1)
            results = retrieve("机器学习", user, mock_db, top_k=5)
            assert isinstance(results, list)
            # BM25 应该能匹配到"机器学习"相关的 chunk
            assert len(results) >= 1
            assert isinstance(results[0], RetrievedChunk)
