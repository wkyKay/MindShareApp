"""检索器重写。

升级点：
- 从 Qdrant 向量库检索（替换暴力计算）
- 混合检索：稠密向量 + 稀疏向量（关键词）
- RRF 融合排序（替换固定权重 0.6/0.4）
- 权限过滤在向量库 payload 层面完成
- 查询改写支持（多查询扩展，默认关闭）
- 重排序（cross-encoder，现有接口升级）
- API 零破坏：retrieve 函数签名与返回格式兼容
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List, Optional

from sqlalchemy.orm import Session

from ..config import (
    QUERY_REWRITE_ENABLED,
    RERANKER_CANDIDATE_K,
    SPARSE_ENABLED,
)
from ..models import Follow, Post, TextChunk, User
from .embedder import embed_text, embed_texts, is_available as embedding_available
from .reranker import rerank as rerank_chunks
from .sparse_encoder import get_sparse_encoder, is_sparse_available
from .vector_store import SearchResult, get_vector_store, is_vector_store_available

logger = logging.getLogger(__name__)

TOP_K = 5
RRF_K = 60  # RRF 融合常数


@dataclass
class RetrievedChunk:
    """检索结果 chunk（与旧接口兼容）。"""
    chunk: TextChunk
    score: float
    post_title: str
    rerank_score: Optional[float] = None
    references: dict = field(default_factory=dict)  # 引用溯源信息


def retrieve(
    query: str,
    current_user: User,
    db: Session,
    top_k: int = TOP_K,
    post_ids: Optional[set[int]] = None,
    include_archived_own: bool = False,
) -> List[RetrievedChunk]:
    """混合召回 + 可选重排序，按权限过滤后返回 top_k。

    参数与旧版完全兼容。
    """
    # 1. 构建可见性 filter
    vs_filter = _build_visibility_filter(current_user, db, post_ids, include_archived_own)

    # 2. 查询改写（可选，默认关闭）
    queries = _maybe_rewrite_query(query)

    # 3. 多路召回
    all_results: dict[str, SearchResult] = {}  # point_id -> SearchResult
    all_rankings: List[List[str]] = []  # 每路的 ID 排序列表，用于 RRF

    for q in queries:
        # 稠密检索
        dense_ranking = _search_dense(q, vs_filter, RERANKER_CANDIDATE_K)
        if dense_ranking:
            for r in dense_ranking:
                pid = f"{r.post_id}_{r.chunk_index}"
                if pid not in all_results:
                    all_results[pid] = r
            all_rankings.append([f"{r.post_id}_{r.chunk_index}" for r in dense_ranking])

        # 稀疏检索（关键词）
        if SPARSE_ENABLED and is_sparse_available():
            sparse_ranking = _search_sparse(q, vs_filter, RERANKER_CANDIDATE_K)
            if sparse_ranking:
                for r in sparse_ranking:
                    pid = f"{r.post_id}_{r.chunk_index}"
                    if pid not in all_results:
                        all_results[pid] = r
                all_rankings.append([f"{r.post_id}_{r.chunk_index}" for r in sparse_ranking])

    if not all_rankings:
        # 向量库不可用或无结果，降级到 BM25 暴力检索（兼容旧行为）
        return _fallback_bm25(query, current_user, db, top_k, post_ids, include_archived_own)

    # 4. RRF 融合
    merged_scores = _rrf(all_rankings)

    # 5. 取候选
    candidate_k = max(top_k, RERANKER_CANDIDATE_K)
    ranked_ids = sorted(merged_scores.items(), key=lambda x: x[1], reverse=True)[:candidate_k]

    # 6. 加载 post 标题和构建 RetrievedChunk
    post_ids_set = {all_results[pid].post_id for pid, _ in ranked_ids if pid in all_results}
    post_titles = _load_post_titles(db, post_ids_set)

    candidates: List[RetrievedChunk] = []
    for pid, score in ranked_ids:
        if pid not in all_results:
            continue
        r = all_results[pid]
        # 构造 TextChunk 对象（轻量，不查 DB）
        chunk = _make_text_chunk(r)
        candidates.append(RetrievedChunk(
            chunk=chunk,
            score=score,
            post_title=post_titles.get(r.post_id, ""),
            references={
                "post_id": r.post_id,
                "chunk_index": r.chunk_index,
                "post_title": post_titles.get(r.post_id, ""),
            },
        ))

    if not candidates:
        return []

    # 7. 重排序
    reranked = rerank_chunks(query, candidates, top_k)
    return reranked


# ── 检索支路 ────────────────────────────────────────────────────────


def _search_dense(query: str, vs_filter: dict, top_k: int) -> List[SearchResult]:
    """稠密向量检索。"""
    if not embedding_available():
        return []
    if not is_vector_store_available():
        return []

    query_emb = embed_text(query)
    if query_emb is None:
        return []

    vs = get_vector_store()
    try:
        return vs.search(query_emb, top_k=top_k, filter=vs_filter)
    except Exception as exc:
        logger.warning("Dense search failed: %s", exc)
        return []


def _search_sparse(query: str, vs_filter: dict, top_k: int) -> List[SearchResult]:
    """稀疏向量（关键词）检索。"""
    if not is_vector_store_available():
        return []
    encoder = get_sparse_encoder()
    if encoder is None:
        return []

    sv = encoder.encode(query)
    if not sv.indices:
        return []

    vs = get_vector_store()
    try:
        sparse_query = {"indices": sv.indices, "values": sv.values}
        # 用稠密向量做占位（Qdrant 混合检索需要两路），实际走 _search_hybrid 路径
        # 这里直接用 vector_store.search 的 query_sparse 参数
        # 由于我们实现中混合检索在 vector_store 内部做 RRF，
        # 这里简化为：如果只有稀疏也走 search 接口
        # 传入空 dense + 稀疏的方式有问题，改用纯 BM25 兜底
        # 为简单起见，稀疏检索单独走 Qdrant 的 sparse vector search
        return _search_sparse_only(vs, sv, vs_filter, top_k)
    except Exception as exc:
        logger.warning("Sparse search failed: %s", exc)
        return []


def _search_sparse_only(vs, sv, vs_filter: dict, top_k: int) -> List[SearchResult]:
    """纯稀疏向量检索。"""
    try:
        from qdrant_client.models import SparseVector, Filter

        sparse_vec = SparseVector(indices=sv.indices, values=sv.values)
        # 构建 filter
        qdrant_filter = vs._build_filter(vs_filter) if vs_filter else None

        results = vs._client.search(
            collection_name=vs._collection,
            query_vector=("sparse", sparse_vec),
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
            for hit in results
        ]
    except Exception as exc:
        logger.warning("Sparse-only search failed: %s", exc)
        return []


# ── RRF 融合 ────────────────────────────────────────────────────────


def _rrf(rankings: List[List[str]], k: int = RRF_K) -> dict[str, float]:
    """倒数排名融合（Reciprocal Rank Fusion）。

    rankings: 每路的有序 ID 列表
    返回: {id: 融合分数}
    """
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            scores[doc_id] = scores.get(doc_id, 0) + 1 / (k + rank + 1)
    return scores


# ── 权限过滤 ────────────────────────────────────────────────────────


def _build_visibility_filter(
    user: User,
    db: Session,
    post_ids: Optional[set[int]] = None,
    include_archived_own: bool = False,
) -> dict:
    """构建向量库检索用的可见性 filter。

    与 _visible_chunks 逻辑对齐：
    - public → 所有人
    - followers → 已关注作者 + 作者本人
    - private → 仅作者
    - status: published（含归档自己的）
    """
    following_ids = {
        row[0]
        for row in db.query(Follow.following_id)
        .filter(Follow.follower_id == user.id)
        .all()
    }

    vs_filter: dict = {}

    # 状态过滤
    statuses = ["published"]
    if include_archived_own:
        statuses.append("archived")
    vs_filter["status_in"] = statuses

    # 可见性 + 作者的复合条件，Qdrant filter 不支持复杂 OR
    # 简化方案：用 post_ids 白名单方式
    # 先从 DB 取可见的 post_id 集合（只取 ID，不加载 chunk 内容，很快）
    visible_post_ids = _get_visible_post_ids(user, db, following_ids, include_archived_own)

    if post_ids is not None:
        visible_post_ids = visible_post_ids & post_ids

    if visible_post_ids:
        # 集合太大时分批处理，这里先全放（Qdrant MatchAny 支持大量值）
        vs_filter["post_ids"] = list(visible_post_ids)

    return vs_filter


def _get_visible_post_ids(
    user: User,
    db: Session,
    following_ids: set[int],
    include_archived_own: bool,
) -> set[int]:
    """获取当前用户可见的 post_id 集合（用于向量库过滤）。"""
    q = db.query(Post.id)

    status_filter = Post.status == "published"
    if include_archived_own:
        status_filter = (Post.status == "published") | (
            (Post.status == "archived") & (Post.author_id == user.id)
        )

    rows = q.filter(
        status_filter,
        (Post.visibility == "public")
        | ((Post.visibility == "followers") & Post.author_id.in_(following_ids | {user.id}))
        | ((Post.visibility == "private") & (Post.author_id == user.id)),
    ).all()
    return {row[0] for row in rows}


# ── 查询改写 ────────────────────────────────────────────────────────


def _maybe_rewrite_query(query: str) -> List[str]:
    """查询改写（默认关闭）。"""
    if not QUERY_REWRITE_ENABLED:
        return [query]

    try:
        from .query_rewriter import expand_query
        expanded = expand_query(query)
        if expanded:
            return expanded
    except Exception as exc:
        logger.warning("Query rewrite failed, using original: %s", exc)

    return [query]


# ── 工具函数 ────────────────────────────────────────────────────────


def _make_text_chunk(r: SearchResult) -> TextChunk:
    """从 SearchResult 构造轻量 TextChunk 对象。"""
    chunk = TextChunk(
        id=0,  # 不使用
        post_id=r.post_id,
        chunk_index=r.chunk_index,
        content=r.content,
    )
    return chunk


def _load_post_titles(db: Session, post_ids: set[int]) -> dict[int, str]:
    if not post_ids:
        return {}
    rows = db.query(Post.id, Post.title).filter(Post.id.in_(post_ids)).all()
    return {row[0]: row[1] for row in rows}


# ── 降级：BM25 暴力检索 ─────────────────────────────────────────────


def _fallback_bm25(
    query: str,
    current_user: User,
    db: Session,
    top_k: int,
    post_ids: Optional[set[int]],
    include_archived_own: bool,
) -> List[RetrievedChunk]:
    """向量库不可用时，回退到旧的 BM25 + 暴力检索。

    保持向后兼容，确保系统始终可用。
    """
    from ..models import TextChunk as TextChunkModel

    # 权限过滤
    following_ids = {
        row[0]
        for row in db.query(Follow.following_id)
        .filter(Follow.follower_id == current_user.id)
        .all()
    }

    status_filter = Post.status == "published"
    if include_archived_own:
        status_filter = (Post.status == "published") | (
            (Post.status == "archived") & (Post.author_id == current_user.id)
        )

    chunks_q = (
        db.query(TextChunkModel)
        .join(Post, Post.id == TextChunkModel.post_id)
        .filter(
            status_filter,
            (Post.visibility == "public")
            | ((Post.visibility == "followers") & Post.author_id.in_(following_ids | {current_user.id}))
            | ((Post.visibility == "private") & (Post.author_id == current_user.id)),
        )
    )
    if post_ids is not None:
        chunks_q = chunks_q.filter(TextChunkModel.post_id.in_(post_ids))

    allowed_chunks = chunks_q.all()
    if not allowed_chunks:
        return []

    # BM25 评分
    scores = _compute_bm25(query, [c.content for c in allowed_chunks])

    post_titles = _load_post_titles(db, {c.post_id for c in allowed_chunks})

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
    chunk_map = {i: c for i, c in enumerate(allowed_chunks)}

    results = []
    for idx, score in ranked:
        chunk = chunk_map.get(idx)
        if chunk is None:
            continue
        results.append(RetrievedChunk(
            chunk=chunk,
            score=score,
            post_title=post_titles.get(chunk.post_id, ""),
        ))

    return results


def _compute_bm25(query: str, docs: List[str]) -> dict[int, float]:
    """简单 BM25 实现（用于降级）。"""
    import math

    K1 = 1.5
    B = 0.75

    def _tokenize(text: str) -> List[str]:
        tokens: List[str] = []
        buf = ""
        for ch in text.lower():
            if ch.isalnum():
                buf += ch
            elif "\u4e00" <= ch <= "\u9fff":
                if buf:
                    tokens.append(buf)
                    buf = ""
                tokens.append(ch)
            else:
                if buf:
                    tokens.append(buf)
                    buf = ""
        if buf:
            tokens.append(buf)
        return tokens

    query_tokens = _tokenize(query)
    if not query_tokens or not docs:
        return {}

    doc_tokens_list = [_tokenize(d) for d in docs]
    doc_lengths = [len(t) for t in doc_tokens_list]
    N = len(docs)
    avg_dl = sum(doc_lengths) / N if N else 1

    # DF
    df: dict[str, int] = {}
    for tokens in doc_tokens_list:
        for token in set(tokens):
            df[token] = df.get(token, 0) + 1

    # IDF
    idf: dict[str, float] = {}
    for token, count in df.items():
        idf[token] = math.log(1 + (N - count + 0.5) / (count + 0.5))

    # 评分
    scores: dict[int, float] = {}
    for i, tokens in enumerate(doc_tokens_list):
        score = 0.0
        dl = doc_lengths[i]
        tf: dict[str, int] = {}
        for t in tokens:
            tf[t] = tf.get(t, 0) + 1
        for token in query_tokens:
            if token not in idf:
                continue
            f = tf.get(token, 0)
            numerator = f * (K1 + 1)
            denominator = f + K1 * (1 - B + B * (dl / avg_dl))
            score += idf[token] * numerator / denominator
        scores[i] = score

    return scores
