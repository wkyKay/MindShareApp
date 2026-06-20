import json
import logging
from typing import Optional

import redis

from .config import REDIS_URL

logger = logging.getLogger(__name__)
DEFAULT_TTL = 60

_pool: Optional[redis.Redis] = None


def _client() -> Optional[redis.Redis]:
    global _pool
    if _pool is not None:
        return _pool
    try:
        _pool = redis.Redis.from_url(REDIS_URL, socket_connect_timeout=2, socket_timeout=2)
        _pool.ping()
    except Exception as exc:
        logger.warning("Redis unavailable, cache disabled: %s", exc)
        _pool = None
    return _pool


def _get(key: str) -> Optional[str]:
    client = _client()
    if client is None:
        return None
    try:
        return client.get(key)
    except Exception:
        return None


def _set(key: str, value: str, ttl: int = DEFAULT_TTL) -> None:
    client = _client()
    if client is None:
        return
    try:
        client.setex(key, ttl, value)
    except Exception:
        pass


def _delete(*keys: str) -> None:
    client = _client()
    if client is None:
        return
    try:
        client.delete(*keys)
    except Exception:
        pass


def _delete_pattern(pattern: str) -> None:
    client = _client()
    if client is None:
        return
    try:
        matching = client.keys(pattern)
        if matching:
            client.delete(*matching)
    except Exception:
        pass


# ── Notification unread count ──────────────────────────────────────────

UNREAD_COUNT_KEY = "ntf:unread:{}"


def get_unread_count(user_id: int) -> Optional[int]:
    raw = _get(UNREAD_COUNT_KEY.format(user_id))
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def set_unread_count(user_id: int, count: int, ttl: int = 30) -> None:
    _set(UNREAD_COUNT_KEY.format(user_id), str(count), ttl)


def invalidate_unread_count(user_id: int) -> None:
    _delete(UNREAD_COUNT_KEY.format(user_id))


# ── Tag suggestions ────────────────────────────────────────────────────

TAG_SUGGEST_KEY = "tags:suggest:{}"


def get_tag_suggestions(prefix: str) -> Optional[list[str]]:
    raw = _get(TAG_SUGGEST_KEY.format(prefix))
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None


def set_tag_suggestions(prefix: str, tags: list[str], ttl: int = 300) -> None:
    _set(TAG_SUGGEST_KEY.format(prefix), json.dumps(tags), ttl)


# ── Hot posts (discover / following) ───────────────────────────────────

HOT_POSTS_KEY = "posts:hot:{}"


def get_hot_posts(cache_key: str) -> Optional[list[dict]]:
    raw = _get(HOT_POSTS_KEY.format(cache_key))
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None


def set_hot_posts(cache_key: str, posts: list[dict], ttl: int = 60) -> None:
    _set(HOT_POSTS_KEY.format(cache_key), json.dumps(posts, default=str), ttl)


def invalidate_hot_posts() -> None:
    _delete_pattern("posts:hot:*")
