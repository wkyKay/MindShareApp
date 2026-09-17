"""查询改写层。

支持两种策略，可配置切换：
1. 多查询扩展（Multi-Query Expansion）：将问题扩展为 N 个同义查询
2. HyDE（Hypothetical Document Embedding）：先生成假设答案再检索

默认关闭，通过 QUERY_REWRITE_ENABLED / HYDE_ENABLED 环境变量控制。
"""

from __future__ import annotations

import logging
from typing import List, Optional

from ..config import (
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL,
    HYDE_ENABLED,
    QUERY_REWRITE_COUNT,
    QUERY_REWRITE_ENABLED,
)

logger = logging.getLogger(__name__)

MULTI_QUERY_SYSTEM_PROMPT = """你是一个查询扩展助手。请将用户的问题改写为 {count} 个
不同表述的检索查询，用于从知识库中召回相关文档。

要求：
1. 每个查询独立成句，适合做向量检索
2. 覆盖不同的表述方式和关键词选择
3. 保留原始问题的核心意图
4. 只输出查询列表，每行一个，不要编号，不要解释"""


HYDE_SYSTEM_PROMPT = """请针对用户的问题，写一段假设性的参考答案，
长度约 100-200 字。这段答案将用于检索相关文档，不需要完全准确，
只要在语义上接近可能的答案即可。只输出答案文本，不要解释。"""


def expand_query(query: str) -> List[str]:
    """查询改写入口。根据配置返回扩展后的查询列表。

    - 仅 MULTI_QUERY：返回 N 个扩展查询
    - 仅 HYDE：返回 [原问题, 假设答案]
    - 都开启：先扩展，再对每个扩展做 HyDE（成本高，慎用）
    - 都关闭：返回 [原问题]
    """
    if not QUERY_REWRITE_ENABLED and not HYDE_ENABLED:
        return [query]

    queries = [query]

    if QUERY_REWRITE_ENABLED:
        expanded = _multi_query_expand(query)
        if expanded:
            queries = expanded
            # 确保原问题也在里面
            if query not in queries:
                queries.insert(0, query)

    if HYDE_ENABLED:
        # 对每个查询做 HyDE
        hyde_queries = []
        for q in queries:
            hyde_ans = _hyde_generate(q)
            if hyde_ans:
                hyde_queries.append(hyde_ans)
        # 将 HyDE 生成的答案作为额外查询
        queries = queries + hyde_queries

    # 去重
    seen = set()
    unique = []
    for q in queries:
        if q not in seen:
            seen.add(q)
            unique.append(q)

    return unique if unique else [query]


def _multi_query_expand(query: str) -> List[str]:
    """多查询扩展。"""
    try:
        from openai import OpenAI

        client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
        system_prompt = MULTI_QUERY_SYSTEM_PROMPT.format(count=QUERY_REWRITE_COUNT)

        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query},
            ],
            temperature=0.7,
            max_tokens=500,
        )
        content = response.choices[0].message.content or ""
        lines = [line.strip() for line in content.strip().split("\n") if line.strip()]
        # 去掉可能的编号
        cleaned = []
        for line in lines:
            # 去掉 "1. " "2) " 等前缀
            import re
            line = re.sub(r"^\d+[\.\)、]\s*", "", line)
            if line:
                cleaned.append(line)
        return cleaned[:QUERY_REWRITE_COUNT]
    except Exception as exc:
        logger.warning("Multi-query expansion failed: %s", exc)
        return []


def _hyde_generate(query: str) -> Optional[str]:
    """HyDE：生成假设答案。"""
    try:
        from openai import OpenAI

        client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

        response = client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": HYDE_SYSTEM_PROMPT},
                {"role": "user", "content": query},
            ],
            temperature=0.8,
            max_tokens=400,
        )
        content = response.choices[0].message.content
        return content.strip() if content else None
    except Exception as exc:
        logger.warning("HyDE generation failed: %s", exc)
        return None
