"""Redis 缓存层。

统一的 Redis 连接管理 + 各类业务缓存 + 缓存三大问题防护。
"""
from __future__ import annotations

import json
import logging
import random
import time
from typing import Any, Callable

import redis

from .config import (
    REDIS_CONNECT_TIMEOUT,
    REDIS_SOCKET_TIMEOUT,
    REDIS_URL,
)

logger = logging.getLogger(__name__)

# ── 全局常量 ────────────────────────────────────────────────────────

DEFAULT_TTL = 60
TTL_JITTER_RATIO = 0.1  # TTL 抖动幅度 ±10%

NIL_MARKER = "__NIL__"
NIL_TTL = 60  # 空值缓存 60 秒，防穿透

LOCK_KEY_PREFIX = "lock:"
DEFAULT_LOCK_TIMEOUT = 5  # 分布式锁默认超时
DEFAULT_LOCK_WAIT = 0.2   # 等待锁的间隔（秒）
DEFAULT_LOCK_MAX_WAIT = 2.0  # 最大等待时间


# ── 全局 Redis 连接（单例） ────────────────────────────────────────

_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis | None:
    """获取全局 Redis 客户端（单例模式）。

    连接失败时返回 None，所有上层操作需自行处理 None 的情况（降级为无缓存）。
    """
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        _redis_client = redis.Redis.from_url(
            REDIS_URL,
            socket_connect_timeout=REDIS_CONNECT_TIMEOUT,
            socket_timeout=REDIS_SOCKET_TIMEOUT,
            decode_responses=True,
        )
        _redis_client.ping()
    except Exception as exc:
        logger.warning("Redis unavailable, cache disabled: %s", exc)
        _redis_client = None
    return _redis_client


def reset_redis_client() -> None:
    """重置 Redis 连接（测试用）。"""
    global _redis_client
    if _redis_client is not None:
        try:
            _redis_client.close()
        except Exception:
            pass
    _redis_client = None


# ── 底层工具函数 ──────────────────────────────────────────────────

def _jitter_ttl(base_ttl: int) -> int:
    """给 TTL 添加 ±10% 的随机抖动，避免缓存雪崩。"""
    if base_ttl <= 0:
        return base_ttl
    jitter = int(base_ttl * TTL_JITTER_RATIO)
    return base_ttl + random.randint(-jitter, jitter)


def is_nil(value: str | None) -> bool:
    """判断缓存值是否为空值标记（防穿透）。"""
    return value is not None and value == NIL_MARKER


def _get(key: str) -> str | None:
    client = get_redis()
    if client is None:
        return None
    try:
        return client.get(key)
    except Exception:
        return None


def _set(key: str, value: str, ttl: int = DEFAULT_TTL) -> None:
    client = get_redis()
    if client is None:
        return
    try:
        client.setex(key, _jitter_ttl(ttl), value)
    except Exception:
        pass


def _delete(*keys: str) -> None:
    client = get_redis()
    if client is None:
        return
    try:
        client.delete(*keys)
    except Exception:
        pass


def _delete_pattern(pattern: str) -> None:
    """按模式批量删除 key（用 SCAN 替代 KEYS，避免阻塞）。"""
    client = get_redis()
    if client is None:
        return
    try:
        cursor = 0
        batch_size = 100
        while True:
            cursor, keys = client.scan(cursor=cursor, match=pattern, count=batch_size)
            if keys:
                client.delete(*keys)
            if cursor == 0:
                break
    except Exception:
        pass


def set_nil(key: str, ttl: int = NIL_TTL) -> None:
    """缓存空值，防止缓存穿透。"""
    _set(key, NIL_MARKER, ttl)


# ── 分布式互斥锁 ──────────────────────────────────────────────────

def acquire_lock(lock_key: str, timeout: int = DEFAULT_LOCK_TIMEOUT) -> bool:
    """尝试获取分布式锁（非阻塞）。

    基于 Redis SETNX 实现，带超时自动释放，防止死锁。
    """
    client = get_redis()
    if client is None:
        return False
    try:
        return bool(client.set(
            LOCK_KEY_PREFIX + lock_key,
            "1",
            ex=timeout,
            nx=True,
        ))
    except Exception:
        return False


def release_lock(lock_key: str) -> None:
    """释放分布式锁。"""
    _delete(LOCK_KEY_PREFIX + lock_key)


def get_with_lock(
    key: str,
    load_func: Callable[[], Any],
    ttl: int = DEFAULT_TTL,
    lock_timeout: int = DEFAULT_LOCK_TIMEOUT,
    max_wait: float = DEFAULT_LOCK_MAX_WAIT,
) -> Any:
    """带击穿防护的缓存读取（Cache-Aside + 互斥锁）。

    流程：
    1. 查缓存，命中直接返回
    2. 未命中，尝试获取锁
       - 拿到锁：double-check 缓存 → 回源 → 写缓存 → 返回
       - 没拿到锁：等待 + 重试，最多等 max_wait 秒，超时则自行回源
    """
    # 1. 先查缓存
    raw = _get(key)
    if raw is not None and not is_nil(raw):
        try:
            return json.loads(raw)
        except (TypeError, json.JSONDecodeError):
            pass  # 解析失败，当未命中处理
    if is_nil(raw):
        return None

    # 2. 尝试获取锁
    lock_key = f"cache:{key}"
    if acquire_lock(lock_key, lock_timeout):
        try:
            # 3. double-check
            raw = _get(key)
            if raw is not None and not is_nil(raw):
                try:
                    return json.loads(raw)
                except (TypeError, json.JSONDecodeError):
                    pass
            if is_nil(raw):
                return None

            # 4. 回源
            value = load_func()
            if value is None:
                set_nil(key)
            else:
                _set(key, json.dumps(value, default=str), ttl)
            return value
        finally:
            release_lock(lock_key)
    else:
        # 5. 没拿到锁，等待 + 重试
        waited = 0.0
        while waited < max_wait:
            time.sleep(DEFAULT_LOCK_WAIT)
            waited += DEFAULT_LOCK_WAIT
            raw = _get(key)
            if raw is not None and not is_nil(raw):
                try:
                    return json.loads(raw)
                except (TypeError, json.JSONDecodeError):
                    pass
            if is_nil(raw):
                return None
        # 等待超时，降级为直接回源
        return load_func()


# ═══════════════════════════════════════════════════════════════════
#  业务缓存函数
# ═══════════════════════════════════════════════════════════════════

# ── 1. 通知未读数 ──────────────────────────────────────────────────

UNREAD_COUNT_KEY = "ntf:unread:{}"
UNREAD_COUNT_TTL = 30


def get_unread_count(user_id: int) -> int | None:
    raw = _get(UNREAD_COUNT_KEY.format(user_id))
    if raw is None:
        return None
    if is_nil(raw):
        return 0
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def set_unread_count(user_id: int, count: int, ttl: int = UNREAD_COUNT_TTL) -> None:
    _set(UNREAD_COUNT_KEY.format(user_id), str(count), ttl)


def invalidate_unread_count(user_id: int) -> None:
    _delete(UNREAD_COUNT_KEY.format(user_id))


# ── 2. 标签建议 ────────────────────────────────────────────────────

TAG_SUGGEST_KEY = "tags:suggest:{}"
TAG_SUGGEST_TTL = 300


def get_tag_suggestions(prefix: str) -> list[str] | None:
    raw = _get(TAG_SUGGEST_KEY.format(prefix))
    if raw is None or is_nil(raw):
        return None
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None


def set_tag_suggestions(prefix: str, tags: list[str], ttl: int = TAG_SUGGEST_TTL) -> None:
    _set(TAG_SUGGEST_KEY.format(prefix), json.dumps(tags), ttl)


# ── 3. 热门帖子列表 ────────────────────────────────────────────────

HOT_POSTS_KEY = "posts:hot:{}"
HOT_POSTS_TTL = 60


def get_hot_posts(
    cache_key: str,
    load_func: Callable[[], list[dict]] | None = None,
    ttl: int = HOT_POSTS_TTL,
) -> list[dict] | None:
    """获取热门帖子缓存。

    如果传了 load_func，使用带击穿防护的模式（未命中时自动回源）。
    """
    if load_func:
        result = get_with_lock(
            HOT_POSTS_KEY.format(cache_key), load_func, ttl
        )
        return result if isinstance(result, list) else None

    raw = _get(HOT_POSTS_KEY.format(cache_key))
    if raw is None or is_nil(raw):
        return None
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None


def set_hot_posts(cache_key: str, posts: list[dict], ttl: int = HOT_POSTS_TTL) -> None:
    _set(HOT_POSTS_KEY.format(cache_key), json.dumps(posts, default=str), ttl)


def invalidate_hot_posts() -> None:
    _delete_pattern("posts:hot:*")


# ── 4. 用户信息缓存 ────────────────────────────────────────────────

USER_KEY = "user:{}"
USER_TTL = 300  # 5 分钟


def get_user_cache(user_id: int) -> dict | None:
    raw = _get(USER_KEY.format(user_id))
    if raw is None or is_nil(raw):
        return None
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None


def set_user_cache(user_id: int, user_data: dict, ttl: int = USER_TTL) -> None:
    _set(USER_KEY.format(user_id), json.dumps(user_data, default=str), ttl)


def invalidate_user_cache(user_id: int) -> None:
    _delete(USER_KEY.format(user_id))


# ── 5. 翻译缓存 ────────────────────────────────────────────────────

TRANSLATE_KEY = "translate:{}:{}:{}"  # source_hash:source_lang:target_lang
TRANSLATE_TTL = 86400 * 7  # 7 天


def _translate_cache_key(source_hash: str, source_lang: str, target_lang: str) -> str:
    return TRANSLATE_KEY.format(source_hash, source_lang, target_lang)


def get_translation(source_hash: str, source_lang: str, target_lang: str) -> str | None:
    raw = _get(_translate_cache_key(source_hash, source_lang, target_lang))
    if raw is None or is_nil(raw):
        return None
    return raw


def set_translation(
    source_hash: str,
    source_lang: str,
    target_lang: str,
    translated_text: str,
    ttl: int = TRANSLATE_TTL,
) -> None:
    _set(
        _translate_cache_key(source_hash, source_lang, target_lang),
        translated_text,
        ttl,
    )


def invalidate_translation(source_hash: str, source_lang: str, target_lang: str) -> None:
    _delete(_translate_cache_key(source_hash, source_lang, target_lang))


# ── 6. 验证码 ──────────────────────────────────────────────────────

CAPTCHA_KEY = "captcha:{}"
CAPTCHA_TTL = 300  # 5 分钟
CAPTCHA_MAX_ATTEMPTS = 5


def set_captcha(captcha_id: str, code_hash: str, purpose: str) -> None:
    """存储验证码到 Redis。"""
    data = json.dumps({
        "code_hash": code_hash,
        "purpose": purpose,
        "failed_attempts": 0,
        "used": False,
    })
    _set(CAPTCHA_KEY.format(captcha_id), data, CAPTCHA_TTL)


def get_captcha(captcha_id: str) -> dict | None:
    """获取验证码信息。"""
    raw = _get(CAPTCHA_KEY.format(captcha_id))
    if raw is None or is_nil(raw):
        return None
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None


def increment_captcha_attempts(captcha_id: str) -> int | None:
    """原子性增加失败尝试次数，返回当前次数。"""
    client = get_redis()
    if client is None:
        return None
    key = CAPTCHA_KEY.format(captcha_id)
    try:
        raw = client.get(key)
        if raw is None:
            return None
        data = json.loads(raw)
        data["failed_attempts"] += 1
        # 保持原有 TTL
        ttl = client.ttl(key)
        client.setex(key, ttl if ttl > 0 else CAPTCHA_TTL, json.dumps(data))
        return data["failed_attempts"]
    except Exception:
        return None


def mark_captcha_used(captcha_id: str) -> None:
    """标记验证码已使用。"""
    client = get_redis()
    if client is None:
        return
    key = CAPTCHA_KEY.format(captcha_id)
    try:
        raw = client.get(key)
        if raw:
            data = json.loads(raw)
            data["used"] = True
            ttl = client.ttl(key)
            client.setex(key, ttl if ttl > 0 else CAPTCHA_TTL, json.dumps(data))
    except Exception:
        pass


def delete_captcha(captcha_id: str) -> None:
    _delete(CAPTCHA_KEY.format(captcha_id))


# ── 7. 帖子详情缓存 ────────────────────────────────────────────────

POST_KEY = "post:{}"
POST_TTL = 300  # 5 分钟


def get_post_cache(post_id: int) -> dict | None:
    raw = _get(POST_KEY.format(post_id))
    if raw is None or is_nil(raw):
        return None
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return None


def set_post_cache(post_id: int, post_data: dict, ttl: int = POST_TTL) -> None:
    _set(POST_KEY.format(post_id), json.dumps(post_data, default=str), ttl)


def invalidate_post_cache(post_id: int) -> None:
    _delete(POST_KEY.format(post_id))


# ── 8. 用户点赞状态缓存（Redis Set） ───────────────────────────────

USER_LIKES_KEY = "user:{}:likes:posts"
USER_LIKES_TTL = 1800  # 30 分钟


def get_user_likes(user_id: int, post_ids: list[int]) -> set[int]:
    """批量获取用户点赞过的帖子 ID（返回集合）。

    如果缓存未建立（key 不存在），返回空集合，由上层回源并回填。
    """
    client = get_redis()
    if client is None:
        return set()
    key = USER_LIKES_KEY.format(user_id)
    try:
        if not client.exists(key):
            return set()
        if not post_ids:
            return set()
        # SMISMEMBER 批量判断（Redis 6.2+ 支持）
        try:
            results = client.smismember(key, *post_ids)
            return {pid for pid, is_member in zip(post_ids, results) if is_member}
        except Exception:
            # Redis 版本不支持时降级为逐个判断
            liked = set()
            for pid in post_ids:
                if client.sismember(key, pid):
                    liked.add(pid)
            return liked
    except Exception:
        return set()


def set_user_likes(user_id: int, post_ids: list[int]) -> None:
    """批量设置用户点赞状态（缓存初始化用）。"""
    client = get_redis()
    if client is None:
        return
    key = USER_LIKES_KEY.format(user_id)
    try:
        if post_ids:
            client.sadd(key, *post_ids)
        client.expire(key, USER_LIKES_TTL)
    except Exception:
        pass


def add_user_like(user_id: int, post_id: int) -> None:
    """添加单个点赞状态。"""
    client = get_redis()
    if client is None:
        return
    key = USER_LIKES_KEY.format(user_id)
    try:
        client.sadd(key, post_id)
        client.expire(key, USER_LIKES_TTL)
    except Exception:
        pass


def remove_user_like(user_id: int, post_id: int) -> None:
    """移除单个点赞状态。"""
    client = get_redis()
    if client is None:
        return
    key = USER_LIKES_KEY.format(user_id)
    try:
        client.srem(key, post_id)
    except Exception:
        pass


def invalidate_user_likes(user_id: int) -> None:
    _delete(USER_LIKES_KEY.format(user_id))


# ── 9. 用户收藏状态缓存（Redis Set） ───────────────────────────────

USER_FAVORITES_KEY = "user:{}:favorites:posts"
USER_FAVORITES_TTL = 1800  # 30 分钟


def get_user_favorites(user_id: int, post_ids: list[int]) -> set[int]:
    """批量获取用户收藏过的帖子 ID。"""
    client = get_redis()
    if client is None:
        return set()
    key = USER_FAVORITES_KEY.format(user_id)
    try:
        if not client.exists(key):
            return set()
        if not post_ids:
            return set()
        try:
            results = client.smismember(key, *post_ids)
            return {pid for pid, is_member in zip(post_ids, results) if is_member}
        except Exception:
            liked = set()
            for pid in post_ids:
                if client.sismember(key, pid):
                    liked.add(pid)
            return liked
    except Exception:
        return set()


def add_user_favorite(user_id: int, post_id: int) -> None:
    client = get_redis()
    if client is None:
        return
    key = USER_FAVORITES_KEY.format(user_id)
    try:
        client.sadd(key, post_id)
        client.expire(key, USER_FAVORITES_TTL)
    except Exception:
        pass


def remove_user_favorite(user_id: int, post_id: int) -> None:
    client = get_redis()
    if client is None:
        return
    key = USER_FAVORITES_KEY.format(user_id)
    try:
        client.srem(key, post_id)
    except Exception:
        pass


def invalidate_user_favorites(user_id: int) -> None:
    _delete(USER_FAVORITES_KEY.format(user_id))
