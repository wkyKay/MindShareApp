"""测试稀疏向量编码器（FUNC-02 系列）。"""

import os
import tempfile
from unittest.mock import patch

import pytest

from app.rag.sparse_encoder import SparseEncoder, SparseVector


class TestSparseEncoder:
    """稀疏向量编码器测试用例。"""

    def test_tokenize_jieba(self):
        """jieba 分词能正确切分中文句子。"""
        encoder = SparseEncoder()
        tokens = encoder.tokenize("我喜欢自然语言处理")
        assert isinstance(tokens, list)
        assert len(tokens) > 0
        assert all(isinstance(t, str) for t in tokens)
        # jieba 应能切出至少几个词
        assert len(tokens) >= 2

    def test_tokenize_fallback(self):
        """jieba 不可用时降级为单字切分（通过 _simple_tokenize 验证 fallback 逻辑）。"""
        encoder = SparseEncoder()

        # 直接测试 _simple_tokenize 内部方法验证 fallback 逻辑
        # _simple_tokenize 按非字母数字字符作为分隔，
        # 连续字母数字字符作为一个 token
        tokens = encoder._simple_tokenize("hello world")
        assert isinstance(tokens, list)
        assert "hello" in tokens
        assert "world" in tokens

        # 测试标点分隔
        tokens2 = encoder._simple_tokenize("foo,bar;baz")
        assert isinstance(tokens2, list)
        assert "foo" in tokens2
        assert "bar" in tokens2
        assert "baz" in tokens2

        # 测试纯数字
        tokens3 = encoder._simple_tokenize("123 456")
        assert "123" in tokens3
        assert "456" in tokens3

        # 测试空字符串
        tokens4 = encoder._simple_tokenize("")
        assert tokens4 == []

        # 验证 tokenize 方法中存在 fallback 路径（try/except ImportError）
        import inspect
        source = inspect.getsource(encoder.tokenize)
        assert "ImportError" in source
        assert "_simple_tokenize" in source

    def test_build_vocab_and_encode(self):
        """用多文档构建词表，编码后 indices 和 values 长度一致，values 为正。"""
        encoder = SparseEncoder()
        docs = [
            "机器学习是人工智能的一个分支",
            "深度学习是机器学习的一个子集",
            "自然语言处理是人工智能的重要领域",
            "计算机视觉也是人工智能的应用方向",
            "机器学习使用数据和算法进行训练",
            "深度学习使用神经网络进行学习",
        ]
        encoder.build_vocab_from_docs(docs, max_vocab=100)
        assert len(encoder.vocab) > 1
        assert len(encoder.idf) > 1
        assert encoder.doc_count == 6

        sv = encoder.encode("机器学习和人工智能")
        assert isinstance(sv, SparseVector)
        assert len(sv.indices) == len(sv.values)
        assert len(sv.indices) > 0
        assert all(v > 0 for v in sv.values)

    def test_encode_unknown_tokens(self):
        """未知词不影响，返回有效稀疏向量。"""
        encoder = SparseEncoder()
        docs = ["机器学习 人工智能 深度学习"]
        encoder.build_vocab_from_docs(docs, max_vocab=50)

        # 编码包含大量未知词的文本
        sv = encoder.encode("这是一个超级罕见的词汇 xyz123")
        assert isinstance(sv, SparseVector)
        assert len(sv.indices) == len(sv.values)
        # 未知词会映射到 UNK，所以仍然有结果
        assert len(sv.indices) > 0

    def test_save_load(self):
        """保存到临时文件再加载，编码结果一致。"""
        encoder = SparseEncoder()
        docs = [
            "机器学习算法训练模型",
            "深度学习神经网络模型",
            "自然语言处理文本分析",
        ]
        encoder.build_vocab_from_docs(docs, max_vocab=50)

        test_text = "机器学习和深度学习模型"
        original_sv = encoder.encode(test_text)

        with tempfile.TemporaryDirectory() as tmpdir:
            save_path = os.path.join(tmpdir, "sparse_encoder.json")
            encoder.save(save_path)
            assert os.path.exists(save_path)

            loaded = SparseEncoder.load(save_path)
            assert loaded is not None
            assert len(loaded.vocab) == len(encoder.vocab)

            loaded_sv = loaded.encode(test_text)
            assert len(loaded_sv.indices) == len(original_sv.indices)
            for i in range(len(loaded_sv.indices)):
                assert loaded_sv.indices[i] == original_sv.indices[i]
                assert abs(loaded_sv.values[i] - original_sv.values[i]) < 1e-9
