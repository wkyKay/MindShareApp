import logging
from typing import TYPE_CHECKING, List

from ..config import RERANKER_BATCH_SIZE, RERANKER_MODEL, RERANKER_PROVIDER

if TYPE_CHECKING:
    from .retriever import RetrievedChunk

logger = logging.getLogger(__name__)

_cross_encoder = None
_cross_encoder_load_failed = False


def is_available() -> bool:
    return RERANKER_PROVIDER == "local" and bool(RERANKER_MODEL)


def rerank(query: str, chunks: List["RetrievedChunk"], top_k: int) -> List["RetrievedChunk"]:
    """Use a cross-encoder to rerank retrieved chunks.

    If reranking is unavailable or fails, return the original retrieval order.
    """
    if not chunks or not is_available():
        return chunks[:top_k]

    model = _get_cross_encoder()
    if model is None:
        return chunks[:top_k]

    try:
        pairs = [(query, item.chunk.content) for item in chunks]
        scores = model.predict(pairs, batch_size=max(1, RERANKER_BATCH_SIZE))
        for item, score in zip(chunks, scores):
            item.rerank_score = float(score)
        return sorted(chunks, key=lambda item: item.rerank_score, reverse=True)[:top_k]
    except Exception as exc:
        logger.warning("Cross-encoder rerank failed: %s", exc)
        return chunks[:top_k]


def _get_cross_encoder():
    global _cross_encoder, _cross_encoder_load_failed

    if _cross_encoder is not None:
        return _cross_encoder
    if _cross_encoder_load_failed:
        return None

    try:
        from sentence_transformers import CrossEncoder

        _cross_encoder = CrossEncoder(RERANKER_MODEL)
        return _cross_encoder
    except Exception as exc:
        _cross_encoder_load_failed = True
        logger.warning("Cross-encoder model is unavailable: %s", exc)
        return None
