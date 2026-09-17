"""向量存储抽象层。

屏蔽底层向量数据库差异，当前实现：
- QdrantLocal: qdrant-client 本地持久化模式（零依赖，适合中小数据量）

未来可平滑切换：Qdrant 服务端、pgvector、Pinecone 等。
"""

from __future__ import annotations

import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional, Union

from ..config import (
    QDRANT_COLLECTION_NAME,
    QDRANT_EMBEDDING_DIM,
    QDRANT_LOCAL_PATH,
    QDRANT_URL,
    SPARSE_ENABLED,
)

logger = logging.getLogger(__name__)

# 确定性 UUID 命名空间：相同 (post_id, chunk_index) 永远生成同一个 UUID
_POINT_ID_NAMESPACE = uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")

# ── 数据结构 ──────────────────────────────────────────────────────────


@dataclass
class ChunkWithEmbedding:
    """待写入向量库的 chunk + 向量。"""

    post_id: int
    chunk_index: int
    content: str
    dense_embedding: list[float]
    sparse_indices: list[int] = field(default_factory=list)
    sparse_values: list[float] = field(default_factory=list)
    # metadata
    author_id: int = 0
    visibility: str = "public"
    status: str = "published"
    published_at: Optional[str] = None  # ISO format string


@dataclass
class SearchResult:
    """检索结果。"""

    post_id: int
    chunk_index: int
    content: str
    score: float
    metadata: dict[str, Any] = field(default_factory=dict)


# ── 抽象基类 ──────────────────────────────────────────────────────────


class VectorStore(ABC):
    @abstractmethod
    def upsert_chunks(self, chunks: list[ChunkWithEmbedding]) -> None:
        """批量写入/更新向量。"""

    @abstractmethod
    def delete_by_post_id(self, post_id: int) -> None:
        """删除指定文章的所有向量。"""

    @abstractmethod
    def search(
        self,
        query_embedding: list[float],
        top_k: int,
        filter: Optional[dict[str, Any]] = None,
        query_sparse: Optional[dict[str, Any]] = None,
    ) -> list[SearchResult]:
        """混合检索：稠密 + 稀疏（可选），返回带分数的结果。"""

    @abstractmethod
    def count(self, filter: Optional[dict[str, Any]] = None) -> int:
        """统计向量数量。"""


# ── Qdrant 本地实现 ───────────────────────────────────────────────────


class QdrantLocalVectorStore(VectorStore):
    """基于 qdrant-client 本地持久化模式的向量存储。

    配置项：
    - QDRANT_LOCAL_PATH: 本地数据目录（None 则用内存模式）
    - QDRANT_COLLECTION_NAME: collection 名称
    - QDRANT_EMBEDDING_DIM: 向量维度
    """

    def __init__(self) -> None:
        try:
            from qdrant_client import QdrantClient
            from qdrant_client.models import (
                Distance,
                SparseVectorParams,
                VectorParams,
            )
        except ImportError as exc:
            raise RuntimeError(
                "qdrant-client is not installed. Run: pip install qdrant-client"
            ) from exc

        self._QdrantClient = QdrantClient
        self._Distance = Distance
        self._VectorParams = VectorParams
        self._SparseVectorParams = SparseVectorParams

        # 本地模式：path 为 None 时为纯内存模式
        if QDRANT_URL:
            self._client = QdrantClient(url=QDRANT_URL)
        elif QDRANT_LOCAL_PATH:
            self._client = QdrantClient(path=QDRANT_LOCAL_PATH)
        else:
            self._client = QdrantClient(location=":memory:")
            logger.warning("Qdrant running in in-memory mode (data will be lost on restart)")

        self._collection = QDRANT_COLLECTION_NAME
        self._dim = QDRANT_EMBEDDING_DIM
        self._sparse_enabled = SPARSE_ENABLED
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        from qdrant_client.models import VectorParams, Distance

        collections = self._client.get_collections().collections
        collection_names = {c.name for c in collections}

        if self._collection not in collection_names:
            vectors_config = {
                "dense": VectorParams(
                    size=self._dim,
                    distance=Distance.COSINE,
                ),
            }
            if self._sparse_enabled:
                # 稀疏向量配置（Qdrant 1.7+ 支持）
                try:
                    from qdrant_client.models import SparseVectorParams
                    sparse_config = {"sparse": SparseVectorParams()}
                    # 合并到 vectors_config
                    # 注意：Qdrant 本地模式对稀疏向量支持可能有限
                    self._client.create_collection(
                        collection_name=self._collection,
                        vectors_config=vectors_config,
                        sparse_vectors_config=sparse_config,
                    )
                    return
                except (ImportError, Exception) as exc:
                    logger.warning(
                        "Sparse vector not supported in this Qdrant version, "
                        "falling back to dense-only: %s",
                        exc,
                    )
                    self._sparse_enabled = False

            self._client.create_collection(
                collection_name=self._collection,
                vectors_config=vectors_config,
            )
            logger.info("Created Qdrant collection: %s", self._collection)

    def _make_point_id(self, post_id: int, chunk_index: int) -> uuid.UUID:
        """生成确定性 UUID（兼容 Qdrant 本地模式的 UUID 要求）。

        使用 uuid5 基于命名空间生成，相同输入永远得到相同 UUID。
        同时在 payload 中保留 post_id 和 chunk_index 作为业务标识。
        """
        name = f"{post_id}_{chunk_index}"
        return uuid.uuid5(_POINT_ID_NAMESPACE, name)

    def upsert_chunks(self, chunks: list[ChunkWithEmbedding]) -> None:
        from qdrant_client.models import PointStruct, SparseVector

        if not chunks:
            return

        points = []
        for chunk in chunks:
            pid = self._make_point_id(chunk.post_id, chunk.chunk_index)
            vector = {"dense": chunk.dense_embedding}
            if self._sparse_enabled and chunk.sparse_indices:
                vector["sparse"] = SparseVector(
                    indices=chunk.sparse_indices,
                    values=chunk.sparse_values,
                )
            payload = {
                "post_id": chunk.post_id,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "author_id": chunk.author_id,
                "visibility": chunk.visibility,
                "status": chunk.status,
                "published_at": chunk.published_at,
            }
            points.append(PointStruct(id=pid, vector=vector, payload=payload))

        # 分批写入，避免单次过大
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i : i + batch_size]
            self._client.upsert(
                collection_name=self._collection,
                points=batch,
            )
        logger.info("Upserted %d chunks to Qdrant", len(chunks))

    def delete_by_post_id(self, post_id: int) -> None:
        from qdrant_client.models import Filter, FieldCondition, MatchValue

        self._client.delete(
            collection_name=self._collection,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="post_id",
                        match=MatchValue(value=post_id),
                    ),
                ]
            ),
        )
        logger.info("Deleted vectors for post %s from Qdrant", post_id)

    def search(
        self,
        query_embedding: list[float],
        top_k: int,
        filter: Optional[dict[str, Any]] = None,
        query_sparse: Optional[dict[str, Any]] = None,
    ) -> list[SearchResult]:
        from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny

        # 构建 filter
        qdrant_filter = self._build_filter(filter) if filter else None

        # 混合检索：稠密 + 稀疏
        if self._sparse_enabled and query_sparse:
            return self._search_hybrid(
                query_embedding, query_sparse, top_k, qdrant_filter
            )

        # 纯稠密检索
        response = self._client.query_points(
            collection_name=self._collection,
            query=query_embedding,
            using="dense",
            limit=top_k,
            query_filter=qdrant_filter,
            with_payload=True,
        )

        return [
            SearchResult(
                post_id=hit.payload.get("post_id", 0),
                chunk_index=hit.payload.get("chunk_index", 0),
                content=hit.payload.get("content", ""),
                score=hit.score,
                metadata=hit.payload or {},
            )
            for hit in response.points
        ]

    def _search_hybrid(
        self,
        dense_emb: list[float],
        sparse_query: dict[str, Any],
        top_k: int,
        qdrant_filter: Optional[Any],
    ) -> list[SearchResult]:
        """混合检索：稠密 + 稀疏，分别检索后用 RRF 融合。

        当 Qdrant 不支持原生混合检索时，使用此降级方案。
        sparse_query: {"indices": [...], "values": [...]}
        """
        from qdrant_client.models import SparseVector

        # 稠密检索
        dense_response = self._client.query_points(
            collection_name=self._collection,
            query=dense_emb,
            using="dense",
            limit=top_k * 2,
            query_filter=qdrant_filter,
            with_payload=True,
        )
        dense_results = dense_response.points

        # 稀疏检索
        sparse_vec = SparseVector(
            indices=sparse_query.get("indices", []),
            values=sparse_query.get("values", []),
        )
        try:
            sparse_response = self._client.query_points(
                collection_name=self._collection,
                query=sparse_vec,
                using="sparse",
                limit=top_k * 2,
                query_filter=qdrant_filter,
                with_payload=True,
            )
            sparse_results = sparse_response.points
        except Exception as exc:
            logger.warning("Sparse search failed, falling back to dense-only: %s", exc)
            sparse_results = []

        # RRF 融合
        dense_map = {hit.id: (hit, i) for i, hit in enumerate(dense_results)}
        sparse_map = {hit.id: (hit, i) for i, hit in enumerate(sparse_results)}

        all_ids = set(dense_map.keys()) | set(sparse_map.keys())
        rrf_scores: dict[str, float] = {}
        K = 60
        for pid in all_ids:
            score = 0.0
            if pid in dense_map:
                rank = dense_map[pid][1]
                score += 1 / (K + rank + 1)
            if pid in sparse_map:
                rank = sparse_map[pid][1]
                score += 1 / (K + rank + 1)
            rrf_scores[pid] = score

        sorted_ids = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]

        output: list[SearchResult] = []
        for pid, merged_score in sorted_ids:
            hit = dense_map.get(pid, sparse_map.get(pid, (None,)))[0]
            if hit is None:
                continue
            output.append(
                SearchResult(
                    post_id=hit.payload.get("post_id", 0),
                    chunk_index=hit.payload.get("chunk_index", 0),
                    content=hit.payload.get("content", ""),
                    score=merged_score,
                    metadata=hit.payload or {},
                )
            )
        return output

    def _build_filter(self, filter_dict: dict[str, Any]) -> Any:
        """将 dict filter 转为 Qdrant Filter 对象。

        支持的 filter 键：
        - post_ids: list[int] 限定文章 ID
        - author_id: int 限定作者
        - visibility_in: list[str] 可见性列表
        - status_in: list[str] 状态列表
        """
        from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny

        conditions = []

        if "post_ids" in filter_dict and filter_dict["post_ids"]:
            conditions.append(
                FieldCondition(
                    key="post_id",
                    match=MatchAny(any=list(filter_dict["post_ids"])),
                )
            )
        if "author_id" in filter_dict and filter_dict["author_id"]:
            conditions.append(
                FieldCondition(
                    key="author_id",
                    match=MatchValue(value=filter_dict["author_id"]),
                )
            )
        if "visibility_in" in filter_dict and filter_dict["visibility_in"]:
            conditions.append(
                FieldCondition(
                    key="visibility",
                    match=MatchAny(any=list(filter_dict["visibility_in"])),
                )
            )
        if "status_in" in filter_dict and filter_dict["status_in"]:
            conditions.append(
                FieldCondition(
                    key="status",
                    match=MatchAny(any=list(filter_dict["status_in"])),
                )
            )

        if not conditions:
            return None
        return Filter(must=conditions)

    def count(self, filter: Optional[dict[str, Any]] = None) -> int:
        qdrant_filter = self._build_filter(filter) if filter else None
        result = self._client.count(
            collection_name=self._collection,
            count_filter=qdrant_filter,
        )
        return result.count


# ── 单例工厂 ──────────────────────────────────────────────────────────


_vector_store_instance: Optional[VectorStore] = None
_vector_store_init_failed = False


def get_vector_store() -> Optional[VectorStore]:
    """获取向量存储单例。不可用时返回 None。"""
    global _vector_store_instance, _vector_store_init_failed

    if _vector_store_instance is not None:
        return _vector_store_instance
    if _vector_store_init_failed:
        return None

    try:
        _vector_store_instance = QdrantLocalVectorStore()
        return _vector_store_instance
    except Exception as exc:
        _vector_store_init_failed = True
        logger.warning("Vector store initialization failed: %s", exc)
        return None


def is_vector_store_available() -> bool:
    return get_vector_store() is not None
