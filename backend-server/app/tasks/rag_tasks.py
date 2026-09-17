"""RAG 索引任务。

升级点：
- 向量写入 Qdrant（替换 MySQL/SQLite TEXT 字段）
- text_chunks 表保留作为内容 source of truth，但删除 embedding 字段
- 增量更新支持（按内容哈希判断是否变化）
"""

import hashlib
import logging
from typing import List

from sqlalchemy.orm import Session

from ..celery_app import celery_app
from ..database import SessionLocal
from ..models import Post, TextChunk
from ..rag.chunker import split_text
from ..rag.embedder import embed_texts
from ..rag.vector_store import (
    ChunkWithEmbedding,
    get_vector_store,
    is_vector_store_available,
)

logger = logging.getLogger(__name__)


@celery_app.task(
    autoretry_for=(Exception,),
    max_retries=2,
    default_retry_delay=10,
    soft_time_limit=300,
    time_limit=600,
)
def sync_post_chunks(post_id: int) -> None:
    """为指定博客重新生成所有 chunk 和向量（增量更新）。

    流程：
    1. 取博客正文切分为 chunks
    2. 与已有 chunk 做内容比对（按内容哈希）
    3. 仅对新增/变更的 chunk 生成 embedding
    4. 更新 text_chunks 表和 Qdrant 向量库
    """
    db: Session = SessionLocal()
    try:
        post = db.query(Post).filter(Post.id == post_id, Post.status != "deleted").first()
        if post is None:
            _delete_chunks_for_post(db, post_id)
            logger.info("sync_post_chunks: post %s not found or deleted, chunks removed", post_id)
            return

        body = post.body.strip()
        if not body:
            _delete_chunks_for_post(db, post_id)
            return

        # 1. 切分新内容
        new_texts = split_text(body)
        if not new_texts:
            _delete_chunks_for_post(db, post_id)
            return

        # 2. 与已有 chunk 做内容比对
        existing_chunks = db.query(TextChunk).filter(
            TextChunk.post_id == post_id
        ).order_by(TextChunk.chunk_index).all()

        existing_map = {c.chunk_index: c for c in existing_chunks}
        new_hashes = {i: _content_hash(text) for i, text in enumerate(new_texts)}

        to_add: List[tuple[int, str]] = []  # (index, content)
        to_update: List[tuple[int, str, TextChunk]] = []  # (index, content, existing)
        to_delete_ids: List[int] = []  # text chunk ids to delete

        for idx, text in enumerate(new_texts):
            existing = existing_map.get(idx)
            if existing is None:
                to_add.append((idx, text))
            elif _content_hash(existing.content) != new_hashes[idx]:
                to_update.append((idx, text, existing))

        # 多余的旧 chunk 删除
        new_indices = set(range(len(new_texts)))
        for idx, chunk in existing_map.items():
            if idx not in new_indices:
                to_delete_ids.append(chunk.id)

        # 3. 生成需要 embedding 的文本（新增 + 更新）
        embed_texts_list = [text for _, text in to_add] + [text for _, text, _ in to_update]
        embeddings = None
        if embed_texts_list and is_vector_store_available():
            embeddings = embed_texts(embed_texts_list)
            if embeddings is None:
                logger.warning("sync_post_chunks: embedding failed for post %s", post_id)

        # 4. 写入数据库
        embed_idx = 0

        # 新增
        for idx, text in to_add:
            chunk = TextChunk(
                post_id=post_id,
                chunk_index=idx,
                content=text,
                content_hash=new_hashes[idx],
            )
            db.add(chunk)
            embed_idx += 1

        # 更新
        for idx, text, chunk in to_update:
            chunk.content = text
            chunk.content_hash = new_hashes[idx]
            embed_idx += 1

        # 删除
        if to_delete_ids:
            db.query(TextChunk).filter(TextChunk.id.in_(to_delete_ids)).delete(
                synchronize_session=False
            )

        db.commit()

        # 5. 写入 Qdrant
        if is_vector_store_available() and embeddings is not None:
            vs = get_vector_store()
            chunks_to_upsert: List[ChunkWithEmbedding] = []
            emb_idx = 0

            for idx, text in to_add:
                if emb_idx < len(embeddings):
                    chunks_to_upsert.append(ChunkWithEmbedding(
                        post_id=post_id,
                        chunk_index=idx,
                        content=text,
                        dense_embedding=embeddings[emb_idx],
                        author_id=post.author_id,
                        visibility=post.visibility,
                        status=post.status,
                        published_at=post.published_at.isoformat() if post.published_at else None,
                    ))
                    emb_idx += 1

            for idx, text, _ in to_update:
                if emb_idx < len(embeddings):
                    chunks_to_upsert.append(ChunkWithEmbedding(
                        post_id=post_id,
                        chunk_index=idx,
                        content=text,
                        dense_embedding=embeddings[emb_idx],
                        author_id=post.author_id,
                        visibility=post.visibility,
                        status=post.status,
                        published_at=post.published_at.isoformat() if post.published_at else None,
                    ))
                    emb_idx += 1

            if chunks_to_upsert:
                vs.upsert_chunks(chunks_to_upsert)

            # 删除多余的向量
            for idx in existing_map.keys():
                if idx not in new_indices:
                    # 按 post_id + chunk_index 删除
                    _delete_single_chunk_vector(post_id, idx)

        logger.info(
            "sync_post_chunks: post %s indexed %d chunks (added=%d, updated=%d, deleted=%d)",
            post_id, len(new_texts), len(to_add), len(to_update), len(to_delete_ids),
        )

    except Exception as exc:
        logger.exception("sync_post_chunks: failed for post %s", post_id)
        db.rollback()
    finally:
        db.close()


@celery_app.task(
    autoretry_for=(Exception,),
    max_retries=2,
    default_retry_delay=5,
)
def delete_post_chunks(post_id: int) -> None:
    """删除指定博客的所有 chunk（数据库 + 向量库）。"""
    db: Session = SessionLocal()
    try:
        _delete_chunks_for_post(db, post_id)
        db.commit()

        if is_vector_store_available():
            vs = get_vector_store()
            vs.delete_by_post_id(post_id)

        logger.info("delete_post_chunks: post %s chunks removed", post_id)
    except Exception as exc:
        logger.exception("delete_post_chunks: failed for post %s", post_id)
        db.rollback()
    finally:
        db.close()


def _delete_chunks_for_post(db: Session, post_id: int) -> None:
    db.query(TextChunk).filter(TextChunk.post_id == post_id).delete(
        synchronize_session=False
    )


def _delete_single_chunk_vector(post_id: int, chunk_index: int) -> None:
    """删除单个 chunk 的向量。"""
    vs = get_vector_store()
    if vs is None:
        return
    try:
        from qdrant_client.models import PointIdsList
        point_id = f"{post_id}_{chunk_index}"
        vs._client.delete(
            collection_name=vs._collection,
            points_selector=PointIdsList(points=[point_id]),
        )
    except Exception as exc:
        logger.warning("Failed to delete vector for post %s chunk %d: %s", post_id, chunk_index, exc)


def _content_hash(text: str) -> str:
    """计算内容 SHA-256 哈希，用于增量更新判断。"""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
