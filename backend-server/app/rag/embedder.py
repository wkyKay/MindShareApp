import json
import logging
from typing import List, Optional

from openai import OpenAI, OpenAIError

from ..config import (
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    EMBEDDING_MODEL,
    EMBEDDING_BASE_URL,
    EMBEDDING_API_KEY,
)

logger = logging.getLogger(__name__)


def is_available() -> bool:
    return bool(EMBEDDING_MODEL)


def embed_texts(texts: List[str]) -> Optional[List[List[float]]]:
    """对多段文本调用 Embedding API，返回对应的向量列表。

    返回 None 表示 Embedding 服务不可用。
    """
    if not texts or not EMBEDDING_MODEL:
        return None

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


def serialize_embedding(embedding: List[float]) -> str:
    return json.dumps(embedding)


def deserialize_embedding(raw: str) -> List[float]:
    return json.loads(raw)
