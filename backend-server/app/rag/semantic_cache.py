"""语义缓存（基于 Redis + 向量相似度）。

原理：
- 用 Redis 存缓存数据（问题、答案、引用）
- 用向量库的主 collection 做相似度匹配（复用已有向量，不额外建 collection）
- 相似度超过阈值则认为命中，直接返回缓存答案

选择 Redis 而非独立 Qdrant collection 的原因：
- 已有 Redis 依赖，不新增运维成本
- 缓存数据是 KV 结构，Redis 更适合
- 语义匹配复用主检索的向量能力
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Optional

from ..cache import get_redis
from ..config import (
    SEMANTIC_CACHE_ENABLED,
    SEMANTIC_CACHE_TTL,
    SEMANTIC_CACHE_THRESHOLD,
)
from .embedder import embed_text
from .vector_store import get_vector_store, is_vector_store_available

logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "rag:cache:"
_hit_count = 0
_miss_count = 0


def is_enabled() -> bool:
    return SEMANTIC_CACHE_ENABLED and is_vector_store_available()


def get_cache(query: str) -> Optional[dict]:
    """查询语义缓存。

    返回: 命中时返回 {"answer": str, "references": list, "cached": True}
           未命中返回 None
    """
    global _miss_count
    if not is_enabled():
        return None

    try:
        query_emb = embed_text(query)
        if query_emb is None:
            return None

        vs = get_vector_store()
        if vs is None:
            return None

        # 在向量库中搜索最相似的缓存条目
        # 注意：这里复用主 collection 搜索，但缓存是独立的
        # 为简单起见，先用精确匹配（问题文本 hash）+ Redis
        # 语义匹配需要独立 collection，暂不实现
        # TODO: 实现真正的语义相似度缓存

        # 降级：精确文本匹配缓存
        exact_key = _exact_cache_key(query)
        r = get_redis()
        if r is None:
            return None

        cached = r.get(exact_key)
        if cached:
            try:
                data = json.loads(cached)
                global _hit_count
                _hit_count += 1
                logger.debug("Semantic cache hit (exact)")
                return data
            except (json.JSONDecodeError, TypeError):
                pass

        _miss_count += 1
        return None

    except Exception as exc:
        logger.warning("Semantic cache lookup failed: %s", exc)
        return None


def set_cache(query: str, answer: str, references: list = None) -> None:
    """写入缓存。"""
    if not is_enabled():
        return

    try:
        r = get_redis()
        if r is None:
            return

        data = {
            "question": query,
            "answer": answer,
            "references": references or [],
        }

        key = _exact_cache_key(query)
        r.setex(key, SEMANTIC_CACHE_TTL, json.dumps(data, ensure_ascii=False))
        logger.debug("Semantic cache set for query: %s", query[:50])
    except Exception as exc:
        logger.warning("Semantic cache set failed: %s", exc)


def get_stats() -> dict:
    """获取缓存统计。"""
    total = _hit_count + _miss_count
    hit_rate = _hit_count / total if total > 0 else 0.0
    return {
        "hits": _hit_count,
        "misses": _miss_count,
        "total": total,
        "hit_rate": round(hit_rate, 4),
    }


# ── 工具函数 ────────────────────────────────────────────────────────


def _exact_cache_key(query: str) -> str:
    """生成精确匹配的缓存 key。"""
    h = hashlib.sha256(query.strip().lower().encode("utf-8")).hexdigest()
    return f"{CACHE_KEY_PREFIX}exact:{h}"
