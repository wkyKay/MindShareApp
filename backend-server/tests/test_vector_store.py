"""测试向量存储（FUNC-04 系列，使用内存模式）。"""

from unittest.mock import MagicMock, patch

import pytest

from app.rag.vector_store import (
    ChunkWithEmbedding,
    SearchResult,
    VectorStore,
    QdrantLocalVectorStore,
)


def _make_embedding(value, dim=32):
    """生成一个简单的向量，用于测试。

    使用不同索引位设值，确保向量方向不同，余弦相似度有区分度。
    value 决定了在哪个维度上有主要分量（0-based）。
    """
    vec = [0.0] * dim
    idx = int(value) % dim
    vec[idx] = 1.0
    # 加一点小的随机扰动（固定模式，保证可重复）
    vec[(idx + 1) % dim] = 0.1
    return vec


class _InMemoryQdrantClient:
    """模拟 Qdrant 客户端，纯内存实现。

    由于 qdrant-client 本地模式对 string point_id 有 UUID 限制，
    这里用 mock 实现核心功能，用于测试 VectorStore 封装逻辑。
    """

    def __init__(self, location=None, path=None, url=None):
        self._collections = {}
        self._points = {}  # collection_name -> {point_id: point}

    def get_collections(self):
        result = MagicMock()
        result.collections = [
            MagicMock(name=name) for name in self._collections
        ]
        return result

    def create_collection(self, collection_name, vectors_config, sparse_vectors_config=None):
        self._collections[collection_name] = True
        self._points[collection_name] = {}

    def upsert(self, collection_name, points):
        if collection_name not in self._points:
            self._points[collection_name] = {}
        for p in points:
            self._points[collection_name][p.id] = p

    def query_points(self, collection_name, query, using="dense", limit=10,
                     query_filter=None, with_payload=True):
        """模拟 query_points API（Qdrant 1.12+ 取代 search）。"""
        if collection_name not in self._points:
            result = MagicMock()
            result.points = []
            return result

        # 提取查询向量
        query_vec_name = using
        if hasattr(query, "indices") and hasattr(query, "values"):
            # SparseVector 对象
            query_vec = query
        else:
            query_vec = query

        # 计算相似度
        results = []
        for pid, point in self._points[collection_name].items():
            # 过滤
            if query_filter is not None:
                if not self._match_filter(point, query_filter):
                    continue

            vec = point.vector
            if isinstance(vec, dict):
                vec = vec.get(query_vec_name, vec.get("dense", []))

            # 稠密向量：余弦相似度
            if isinstance(query_vec, list):
                score = self._cosine_similarity(query_vec, vec)
            else:
                # 稀疏向量：点积（简化处理，返回 0）
                score = 0.0

            hit = MagicMock()
            hit.id = pid
            hit.score = score
            hit.payload = point.payload if with_payload else None
            results.append(hit)

        results.sort(key=lambda x: x.score, reverse=True)
        response = MagicMock()
        response.points = results[:limit]
        return response

    def delete(self, collection_name, points_selector):
        if collection_name not in self._points:
            return
        # 处理 Filter 删除
        if hasattr(points_selector, "must"):
            to_delete = []
            for pid, point in self._points[collection_name].items():
                if self._match_filter(point, points_selector):
                    to_delete.append(pid)
            for pid in to_delete:
                del self._points[collection_name][pid]
        # 处理 PointIdsList
        elif hasattr(points_selector, "points"):
            for pid in points_selector.points:
                if pid in self._points[collection_name]:
                    del self._points[collection_name][pid]

    def count(self, collection_name, count_filter=None):
        if collection_name not in self._points:
            result = MagicMock()
            result.count = 0
            return result
        if count_filter is None:
            n = len(self._points[collection_name])
        else:
            n = sum(
                1 for p in self._points[collection_name].values()
                if self._match_filter(p, count_filter)
            )
        result = MagicMock()
        result.count = n
        return result

    def _match_filter(self, point, qdrant_filter):
        """简单的 filter 匹配，支持 must 条件中的 FieldCondition。"""
        if not hasattr(qdrant_filter, "must"):
            return True
        for cond in qdrant_filter.must:
            key = cond.key
            match = cond.match
            payload = point.payload or {}

            if hasattr(match, "value"):
                if payload.get(key) != match.value:
                    return False
            elif hasattr(match, "any"):
                if payload.get(key) not in match.any:
                    return False
        return True

    def _cosine_similarity(self, a, b):
        if not a or not b:
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        na = sum(x * x for x in a) ** 0.5
        nb = sum(x * x for x in b) ** 0.5
        if na == 0 or nb == 0:
            return 0.0
        return dot / (na * nb)


@pytest.fixture
def store():
    """创建内存模式的向量存储实例（使用 mock Qdrant 客户端）。"""
    with patch("app.rag.vector_store.QDRANT_LOCAL_PATH", ""), \
         patch("app.rag.vector_store.QDRANT_URL", ""), \
         patch("app.rag.vector_store.QDRANT_COLLECTION_NAME", "test_chunks"), \
         patch("app.rag.vector_store.QDRANT_EMBEDDING_DIM", 32), \
         patch("app.rag.vector_store.SPARSE_ENABLED", False), \
         patch("qdrant_client.QdrantClient", _InMemoryQdrantClient):
        s = QdrantLocalVectorStore()
        yield s


class TestVectorStore:
    """向量存储测试用例。"""

    def test_upsert_and_search(self, store):
        """插入多个 chunk 后搜索，返回 top_k 个结果。"""
        chunks = [
            ChunkWithEmbedding(
                post_id=i,
                chunk_index=0,
                content=f"测试内容 {i}",
                dense_embedding=_make_embedding(float(i + 1)),
            )
            for i in range(5)
        ]
        store.upsert_chunks(chunks)
        assert store.count() == 5

        query_emb = _make_embedding(2.0)
        results = store.search(query_emb, top_k=3)
        assert isinstance(results, list)
        assert len(results) == 3
        for r in results:
            assert isinstance(r, SearchResult)
        # 最相似的应该是 post_id=1 (embedding=[2.0, 0.2, ...])，即 i=1 → post_id=1
        # 向量值 i+1=2.0 对应 post_id=1，与查询向量 [2.0, 0.2, ...] 完全匹配
        assert results[0].post_id == 1
        # 验证相似度为 1.0（相同向量）
        assert abs(results[0].score - 1.0) < 1e-6

    def test_delete_by_post_id(self, store):
        """删除指定 post_id 后搜索不到该 post 的 chunk。"""
        chunks = [
            ChunkWithEmbedding(
                post_id=1, chunk_index=0,
                content="post1 chunk0",
                dense_embedding=_make_embedding(1.0),
            ),
            ChunkWithEmbedding(
                post_id=1, chunk_index=1,
                content="post1 chunk1",
                dense_embedding=_make_embedding(2.0),
            ),
            ChunkWithEmbedding(
                post_id=2, chunk_index=0,
                content="post2 chunk0",
                dense_embedding=_make_embedding(3.0),
            ),
        ]
        store.upsert_chunks(chunks)
        assert store.count() == 3

        store.delete_by_post_id(1)
        assert store.count() == 1

        query_emb = _make_embedding(1.0)
        results = store.search(query_emb, top_k=10)
        post_ids = [r.post_id for r in results]
        assert 1 not in post_ids
        assert 2 in post_ids

    def test_search_with_filter(self, store):
        """post_ids filter 能正确过滤。"""
        chunks = [
            ChunkWithEmbedding(
                post_id=1, chunk_index=0,
                content="post1",
                dense_embedding=_make_embedding(1.0),
            ),
            ChunkWithEmbedding(
                post_id=2, chunk_index=0,
                content="post2",
                dense_embedding=_make_embedding(2.0),
            ),
            ChunkWithEmbedding(
                post_id=3, chunk_index=0,
                content="post3",
                dense_embedding=_make_embedding(3.0),
            ),
        ]
        store.upsert_chunks(chunks)

        query_emb = _make_embedding(2.0)
        results = store.search(query_emb, top_k=10, filter={"post_ids": [1, 3]})
        assert len(results) == 2
        post_ids = [r.post_id for r in results]
        assert 1 in post_ids
        assert 3 in post_ids
        assert 2 not in post_ids

    def test_search_result_fields(self, store):
        """返回结果含 post_id, chunk_index, score, content。"""
        chunks = [
            ChunkWithEmbedding(
                post_id=42, chunk_index=7,
                content="hello world",
                dense_embedding=_make_embedding(1.0),
            ),
        ]
        store.upsert_chunks(chunks)

        query_emb = _make_embedding(1.0)
        results = store.search(query_emb, top_k=1)
        assert len(results) == 1
        r = results[0]
        assert r.post_id == 42
        assert r.chunk_index == 7
        assert r.content == "hello world"
        assert isinstance(r.score, float)
        assert r.score > 0

    def test_point_id_format(self, store):
        """point ID 为确定性 UUID，相同输入永远得到相同 UUID。"""
        import uuid

        pid = store._make_point_id(123, 5)
        assert isinstance(pid, uuid.UUID)

        pid2 = store._make_point_id(9999, 0)
        assert isinstance(pid2, uuid.UUID)

        # 确定性：相同输入得到相同输出
        pid_again = store._make_point_id(123, 5)
        assert pid == pid_again

        # 不同输入得到不同 UUID
        assert pid != pid2
