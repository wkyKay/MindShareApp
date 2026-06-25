import math
import logging
from typing import List, Optional

from sqlalchemy.orm import Session

from ..config import RERANKER_CANDIDATE_K
from .embedder import deserialize_embedding, embed_texts, is_available as embeddings_available
from .reranker import rerank as rerank_chunks
from ..models import Follow, Post, TextChunk, User

logger = logging.getLogger(__name__)

TOP_K = 5
BM25_K1 = 1.5
BM25_B = 0.75


class RetrievedChunk:
    __slots__ = ("chunk", "score", "post_title", "rerank_score")

    def __init__(
        self,
        chunk: TextChunk,
        score: float,
        post_title: str,
        rerank_score: Optional[float] = None,
    ):
        self.chunk = chunk
        self.score = score
        self.post_title = post_title
        self.rerank_score = rerank_score


def retrieve(
    query: str,
    current_user: User,
    db: Session,
    top_k: int = TOP_K,
) -> List[RetrievedChunk]:
    """混合召回 + 可选 cross-encoder 精排，按权限过滤后返回 top_k。"""
    # 权限过滤：只搜当前用户可见的博客
    allowed_chunks = _visible_chunks(current_user, db)
    if not allowed_chunks:
        return []

    query_embedding = _get_query_embedding(query)

    scores: dict[int, float] = {}

    if query_embedding is not None:
        _add_vector_scores(scores, allowed_chunks, query_embedding)

    _add_bm25_scores(scores, allowed_chunks, query)

    if not scores:
        _add_bm25_scores(scores, allowed_chunks, query)  # 保底纯 BM25

    post_titles = _load_post_titles(db, {c.post_id for c in allowed_chunks})

    candidate_k = max(top_k, RERANKER_CANDIDATE_K)
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:candidate_k]

    chunk_map = {c.id: c for c in allowed_chunks}
    candidates = [
        RetrievedChunk(
            chunk=chunk_map[chunk_id],
            score=score,
            post_title=post_titles.get(chunk_map[chunk_id].post_id, ""),
        )
        for chunk_id, score in ranked
        if chunk_id in chunk_map
    ]
    return rerank_chunks(query, candidates, top_k)


# ── helpers ────────────────────────────────────────────────────────────

def _visible_chunks(user: User, db: Session) -> List[TextChunk]:
    """返回当前用户有权查看的所有 chunk。

    可见规则：
    - visibility=public → 所有人可见
    - visibility=followers → 当前用户必须关注了作者
    - visibility=private → 仅作者本人
    - status=published → 已发布
    - status=deleted → 不可见
    """
    following_ids = {
        row[0]
        for row in db.query(Follow.following_id)
        .filter(Follow.follower_id == user.id)
        .all()
    }

    chunks = (
        db.query(TextChunk)
        .join(Post, Post.id == TextChunk.post_id)
        .filter(
            Post.status == "published",
            (Post.visibility == "public")
            | ((Post.visibility == "followers") & Post.author_id.in_(following_ids | {user.id}))
            | ((Post.visibility == "private") & (Post.author_id == user.id)),
        )
        .all()
    )
    return chunks


def _get_query_embedding(query: str) -> Optional[List[float]]:
    if not embeddings_available():
        return None
    vectors = embed_texts([query])
    if not vectors:
        return None
    return vectors[0]


def _add_vector_scores(
    scores: dict[int, float],
    chunks: List[TextChunk],
    query_embedding: List[float],
) -> None:
    for chunk in chunks:
        if chunk.embedding is None:
            continue
        try:
            emb = deserialize_embedding(chunk.embedding)
        except Exception:
            continue
        sim = _cosine_similarity(query_embedding, emb)
        if chunk.id not in scores or sim > scores[chunk.id]:
            scores[chunk.id] = sim


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ── BM25 ────────────────────────────────────────────────────────────────


def _tokenize(text: str) -> List[str]:
    """简单分词：按非字母数字/非 CJK 字符切分，保留连续词。

    CJK 字符按单字处理以支持中文搜索。
    """
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


def _add_bm25_scores(
    scores: dict[int, float],
    chunks: List[TextChunk],
    query: str,
) -> None:
    query_tokens = _tokenize(query)
    if not query_tokens:
        return

    chunk_tokens: dict[int, List[str]] = {}
    doc_lengths: dict[int, int] = {}
    for chunk in chunks:
        tokens = _tokenize(chunk.content)
        chunk_tokens[chunk.id] = tokens
        doc_lengths[chunk.id] = len(tokens)

    N = len(chunks)
    if N == 0:
        return

    avg_dl = sum(doc_lengths.values()) / N if N else 1

    # IDF
    df: dict[str, int] = {}
    for tokens in chunk_tokens.values():
        for token in set(tokens):
            df[token] = df.get(token, 0) + 1

    idf: dict[str, float] = {}
    for token, count in df.items():
        idf[token] = math.log(1 + (N - count + 0.5) / (count + 0.5))

    # BM25 score per chunk
    for chunk_id, tokens in chunk_tokens.items():
        score = 0.0
        dl = doc_lengths[chunk_id]
        tf: dict[str, int] = {}
        for t in tokens:
            tf[t] = tf.get(t, 0) + 1
        for token in query_tokens:
            if token not in idf:
                continue
            f = tf.get(token, 0)
            numerator = f * (BM25_K1 + 1)
            denominator = f + BM25_K1 * (1 - BM25_B + BM25_B * (dl / avg_dl))
            score += idf[token] * numerator / denominator

        if chunk_id in scores:
            scores[chunk_id] = scores[chunk_id] * 0.6 + score * 0.4
        else:
            scores[chunk_id] = score


def _load_post_titles(db: Session, post_ids: set[int]) -> dict[int, str]:
    if not post_ids:
        return {}
    rows = db.query(Post.id, Post.title).filter(Post.id.in_(post_ids)).all()
    return {row[0]: row[1] for row in rows}
