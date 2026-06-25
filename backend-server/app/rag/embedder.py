import json
import logging
import time
from typing import Any, List, Optional

from openai import OpenAI, OpenAIError
import httpx

from ..config import (
    BAIDU_ACCESS_TOKEN_URL,
    BAIDU_API_KEY,
    BAIDU_EMBEDDING_BATCH_SIZE,
    BAIDU_SECRET_KEY,
    BAIDU_WENXIN_BASE_URL,
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    EMBEDDING_API_KEY,
    EMBEDDING_BASE_URL,
    EMBEDDING_MODEL,
    EMBEDDING_PROVIDER,
)

logger = logging.getLogger(__name__)

_baidu_access_token: Optional[str] = None
_baidu_access_token_expires_at = 0.0


def is_available() -> bool:
    if EMBEDDING_PROVIDER == "baidu":
        return bool(EMBEDDING_MODEL and BAIDU_API_KEY and BAIDU_SECRET_KEY)
    return bool(EMBEDDING_MODEL)


def embed_texts(texts: List[str]) -> Optional[List[List[float]]]:
    """对多段文本调用 Embedding API，返回对应的向量列表。

    返回 None 表示 Embedding 服务不可用。
    """
    if not texts or not EMBEDDING_MODEL:
        return None
    if EMBEDDING_PROVIDER == "baidu":
        return _embed_texts_with_baidu(texts)

    return _embed_texts_with_openai_compatible(texts)


def _embed_texts_with_openai_compatible(texts: List[str]) -> Optional[List[List[float]]]:
    api_key = EMBEDDING_API_KEY or DEEPSEEK_API_KEY
    base_url = EMBEDDING_BASE_URL or DEEPSEEK_BASE_URL
    if not api_key:
        logger.warning("Embedding API key not configured, skipping")
        return None

    client = OpenAI(api_key=api_key, base_url=base_url)
    try:
        response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
        return [item.embedding for item in response.data]
    except OpenAIError as exc:
        logger.warning("Embedding API call failed: %s", exc)
        return None
    except Exception as exc:
        logger.warning("Embedding unexpected error: %s", exc)
        return None


def _embed_texts_with_baidu(texts: List[str]) -> Optional[List[List[float]]]:
    if not BAIDU_API_KEY or not BAIDU_SECRET_KEY:
        logger.warning("Baidu embedding credentials not configured, skipping")
        return None

    try:
        token = _get_baidu_access_token()
        embeddings: List[List[float]] = []
        batch_size = max(1, BAIDU_EMBEDDING_BATCH_SIZE)
        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            response = httpx.post(
                f"{BAIDU_WENXIN_BASE_URL}/embeddings/{EMBEDDING_MODEL}",
                params={"access_token": token},
                json={"input": batch},
                timeout=30.0,
            )
            response.raise_for_status()
            payload = response.json()
            if "error_code" in payload:
                logger.warning("Baidu embedding API failed: %s", payload)
                return None
            embeddings.extend(_extract_baidu_embeddings(payload))
        return embeddings if len(embeddings) == len(texts) else None
    except httpx.HTTPError as exc:
        logger.warning("Baidu embedding HTTP call failed: %s", exc)
        return None
    except Exception as exc:
        logger.warning("Baidu embedding unexpected error: %s", exc)
        return None


def _get_baidu_access_token() -> str:
    global _baidu_access_token, _baidu_access_token_expires_at

    now = time.time()
    if _baidu_access_token and now < _baidu_access_token_expires_at:
        return _baidu_access_token

    response = httpx.post(
        BAIDU_ACCESS_TOKEN_URL,
        params={
            "grant_type": "client_credentials",
            "client_id": BAIDU_API_KEY,
            "client_secret": BAIDU_SECRET_KEY,
        },
        timeout=15.0,
    )
    response.raise_for_status()
    payload = response.json()
    access_token = payload.get("access_token")
    if not access_token:
        raise RuntimeError(f"Baidu access token response missing access_token: {payload}")

    expires_in = int(payload.get("expires_in") or 2592000)
    _baidu_access_token = access_token
    _baidu_access_token_expires_at = now + max(60, expires_in - 300)
    return access_token


def _extract_baidu_embeddings(payload: dict[str, Any]) -> List[List[float]]:
    data = payload.get("data")
    if not isinstance(data, list):
        return []

    sorted_items = sorted(
        (item for item in data if isinstance(item, dict)),
        key=lambda item: int(item.get("index", 0)),
    )
    embeddings: List[List[float]] = []
    for item in sorted_items:
        embedding = item.get("embedding")
        if isinstance(embedding, list):
            embeddings.append([float(value) for value in embedding])
    return embeddings


def serialize_embedding(embedding: List[float]) -> str:
    return json.dumps(embedding)


def deserialize_embedding(raw: str) -> List[float]:
    return json.loads(raw)
