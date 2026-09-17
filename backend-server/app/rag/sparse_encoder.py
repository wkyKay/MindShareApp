"""稀疏向量编码器（基于 jieba 分词 + BM25 IDF 权重）。

用于混合检索中的关键词检索支路。
轻量实现，不依赖重型搜索引擎。

词汇表动态维护，IDF 基于已索引文档计算。
"""

from __future__ import annotations

import json
import logging
import math
import os
from collections import Counter
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from ..config import SPARSE_VOCAB_SIZE

logger = logging.getLogger(__name__)

# 全局单例
_sparse_encoder: Optional["SparseEncoder"] = None


@dataclass
class SparseVector:
    indices: List[int]
    values: List[float]


class SparseEncoder:
    """稀疏向量编码器。

    使用 jieba 分词 + IDF 权重构建稀疏向量。
    词汇表大小受限（默认 5 万），超出的低频词映射到 UNK。
    """

    UNK_TOKEN = "<UNK>"
    UNK_INDEX = 0

    def __init__(self, vocab: Optional[Dict[str, int]] = None, idf: Optional[Dict[str, float]] = None):
        self.vocab: Dict[str, int] = vocab or {self.UNK_TOKEN: self.UNK_INDEX}
        self.idf: Dict[str, float] = idf or {}
        self.doc_count = 0
        self._initialized = vocab is not None

    def tokenize(self, text: str) -> List[str]:
        """分词。"""
        try:
            import jieba
            return [tok for tok in jieba.lcut(text) if tok.strip()]
        except ImportError:
            # fallback: 按非字母数字切分 + CJK 单字
            return self._simple_tokenize(text)

    def _simple_tokenize(self, text: str) -> List[str]:
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

    def build_vocab_from_docs(self, docs: List[str], max_vocab: int = SPARSE_VOCAB_SIZE) -> None:
        """从文档集合构建词汇表和 IDF。"""
        df: Counter = Counter()
        self.doc_count = len(docs)

        for doc in docs:
            tokens = set(self.tokenize(doc))
            df.update(tokens)

        # 按文档频率降序，取前 max_vocab - 1（留一个给 UNK）
        top_tokens = [tok for tok, _ in df.most_common(max_vocab - 1)]
        self.vocab = {self.UNK_TOKEN: self.UNK_INDEX}
        for i, tok in enumerate(top_tokens):
            self.vocab[tok] = i + 1

        # 计算 IDF
        N = len(docs) if docs else 1
        self.idf = {}
        for tok, idx in self.vocab.items():
            if tok == self.UNK_TOKEN:
                self.idf[tok] = math.log(1 + N / 1)
            else:
                freq = df.get(tok, 0)
                self.idf[tok] = math.log(1 + (N - freq + 0.5) / (freq + 0.5))

        self._initialized = True
        logger.info("Sparse encoder vocab built: %d tokens from %d docs", len(self.vocab), N)

    def encode(self, text: str) -> SparseVector:
        """将文本编码为稀疏向量。

        向量值 = TF * IDF，做 L2 归一化。
        """
        tokens = self.tokenize(text)
        if not tokens:
            return SparseVector(indices=[], values=[])

        # 映射 token 到索引（OOV 映射到 UNK）
        tf: Counter = Counter()
        for tok in tokens:
            idx = self.vocab.get(tok, self.UNK_INDEX)
            tf[idx] += 1

        indices = []
        values = []
        for idx, count in tf.items():
            # 用 index 反查 token 取 IDF
            tok = self._index_to_token(idx)
            idf_val = self.idf.get(tok, 1.0)
            # BM25 风格的 TF 饱和
            tf_val = count / (1 + count)
            indices.append(idx)
            values.append(tf_val * idf_val)

        # L2 归一化
        norm = math.sqrt(sum(v * v for v in values))
        if norm > 0:
            values = [v / norm for v in values]

        return SparseVector(indices=indices, values=values)

    def _index_to_token(self, idx: int) -> str:
        """根据索引反查 token（用于取 IDF）。"""
        # 为性能考虑，构建反向映射
        if not hasattr(self, "_idx_to_token") or self._idx_to_token is None:
            self._idx_to_token = {v: k for k, v in self.vocab.items()}
        return self._idx_to_token.get(idx, self.UNK_TOKEN)

    def save(self, path: str) -> None:
        """保存词汇表和 IDF 到文件。"""
        data = {
            "vocab": self.vocab,
            "idf": self.idf,
            "doc_count": self.doc_count,
        }
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        logger.info("Sparse encoder saved to %s", path)

    @classmethod
    def load(cls, path: str) -> "SparseEncoder":
        """从文件加载。"""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        encoder = cls(vocab=data["vocab"], idf=data["idf"])
        encoder.doc_count = data.get("doc_count", 0)
        encoder._initialized = True
        logger.info("Sparse encoder loaded from %s (%d tokens)", path, len(encoder.vocab))
        return encoder


def get_sparse_encoder() -> Optional[SparseEncoder]:
    """获取稀疏编码器单例。未初始化时返回 None。"""
    global _sparse_encoder
    return _sparse_encoder


def init_sparse_encoder(docs: Optional[List[str]] = None, save_path: Optional[str] = None) -> Optional[SparseEncoder]:
    """初始化稀疏编码器。

    优先从 save_path 加载；不存在且提供了 docs 则从 docs 构建。
    """
    global _sparse_encoder

    if _sparse_encoder is not None:
        return _sparse_encoder

    # 尝试从文件加载
    if save_path and os.path.exists(save_path):
        try:
            _sparse_encoder = SparseEncoder.load(save_path)
            return _sparse_encoder
        except Exception as exc:
            logger.warning("Failed to load sparse encoder from %s: %s", save_path, exc)

    # 从文档构建
    if docs:
        encoder = SparseEncoder()
        encoder.build_vocab_from_docs(docs)
        if save_path:
            try:
                encoder.save(save_path)
            except Exception as exc:
                logger.warning("Failed to save sparse encoder to %s: %s", save_path, exc)
        _sparse_encoder = encoder
        return _sparse_encoder

    logger.warning("Sparse encoder not initialized (no docs or save path)")
    return None


def is_sparse_available() -> bool:
    return get_sparse_encoder() is not None
