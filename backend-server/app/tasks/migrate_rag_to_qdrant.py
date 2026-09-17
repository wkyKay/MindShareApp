"""全量 RAG 数据迁移脚本。

将数据库中所有已发布帖子重新切分 + 重新 embedding，写入 Qdrant。
同时删除 text_chunks 表中的旧 embedding 字段数据。

用法：
    python -m app.tasks.migrate_rag_to_qdrant

注意：
- 会消耗大量 embedding API token，请确保额度充足
- 脚本是幂等的，可中断后重跑
- 默认跳过已存在且 content_hash 匹配的 chunk
"""

import hashlib
import logging
import sys

# 确保 app 包可导入
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models import Post, TextChunk
from app.rag.chunker import split_text
from app.rag.embedder import embed_texts, is_available as embedding_available
from app.rag.vector_store import (
    ChunkWithEmbedding,
    get_vector_store,
    is_vector_store_available,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def migrate_post(post: Post, db: Session) -> dict:
    """迁移单篇文章的向量数据。

    返回统计信息。
    """
    stats = {"post_id": post.id, "chunks": 0, "new_embeddings": 0, "skipped": 0, "failed": False}

    try:
        body = post.body.strip()
        if not body:
            # 清空
            db.query(TextChunk).filter(TextChunk.post_id == post.id).delete(
                synchronize_session=False
            )
            if is_vector_store_available():
                vs = get_vector_store()
                vs.delete_by_post_id(post.id)
            db.commit()
            return stats

        # 1. 切分
        new_texts = split_text(body)
        if not new_texts:
            db.commit()
            return stats

        stats["chunks"] = len(new_texts)

        # 2. 与已有 chunk 比对
        existing_chunks = (
            db.query(TextChunk)
            .filter(TextChunk.post_id == post.id)
            .order_by(TextChunk.chunk_index)
            .all()
        )
        existing_map = {c.chunk_index: c for c in existing_chunks}

        to_embed: list[tuple[int, str]] = []  # 需要重新 embedding 的 (index, text)
        to_skip: list[int] = []  # 可以跳过的 index

        for idx, text in enumerate(new_texts):
            new_hash = content_hash(text)
            existing = existing_map.get(idx)
            if existing and existing.content_hash == new_hash:
                to_skip.append(idx)
            else:
                to_embed.append((idx, text))

        stats["skipped"] = len(to_skip)
        stats["new_embeddings"] = len(to_embed)

        # 3. 生成新 embedding
        embeddings = []
        if to_embed:
            if not embedding_available():
                logger.warning("Embedding not available, skipping post %d", post.id)
                stats["failed"] = True
                return stats

            texts = [t for _, t in to_embed]
            result = embed_texts(texts)
            if result is None:
                logger.warning("Embedding failed for post %d", post.id)
                stats["failed"] = True
                return stats
            embeddings = result

        # 4. 更新数据库
        # 先删除多余的旧 chunk
        new_indices = set(range(len(new_texts)))
        for idx, chunk in existing_map.items():
            if idx not in new_indices:
                db.delete(chunk)

        # 新增或更新
        emb_idx = 0
        for idx, text in enumerate(new_texts):
            new_hash = content_hash(text)
            existing = existing_map.get(idx)
            if existing:
                if existing.content_hash != new_hash:
                    existing.content = text
                    existing.content_hash = new_hash
            else:
                chunk = TextChunk(
                    post_id=post.id,
                    chunk_index=idx,
                    content=text,
                    content_hash=new_hash,
                )
                db.add(chunk)

        db.commit()

        # 5. 写入 Qdrant
        if is_vector_store_available():
            vs = get_vector_store()
            chunks_to_upsert: list[ChunkWithEmbedding] = []
            emb_idx = 0

            for idx, text in enumerate(new_texts):
                if idx in to_skip:
                    # 已有向量，跳过
                    continue
                if emb_idx >= len(embeddings):
                    break
                chunks_to_upsert.append(ChunkWithEmbedding(
                    post_id=post.id,
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

            # 删除多余的向量（如果数量变少了）
            # 用 delete_by_post_id 再全量写入会更简单，但浪费；这里按 index 精确删
            for idx in existing_map.keys():
                if idx not in new_indices:
                    try:
                        from qdrant_client.models import PointIdsList
                        point_id = f"{post.id}_{idx}"
                        vs._client.delete(
                            collection_name=vs._collection,
                            points_selector=PointIdsList(points=[point_id]),
                        )
                    except Exception:
                        pass

        return stats

    except Exception as exc:
        logger.exception("Failed to migrate post %d: %s", post.id, exc)
        db.rollback()
        stats["failed"] = True
        return stats


def main() -> None:
    logger.info("Starting RAG migration to Qdrant...")
    init_db()

    db: Session = SessionLocal()

    try:
        # 检查向量库
        if not is_vector_store_available():
            logger.error("Vector store is not available. Aborting.")
            sys.exit(1)

        vs = get_vector_store()
        logger.info("Vector store ready, current count: %d", vs.count())

        # 获取所有已发布帖子
        posts = db.query(Post).filter(Post.status != "deleted").order_by(Post.id).all()
        logger.info("Found %d posts to process", len(posts))

        total_chunks = 0
        total_new_embeddings = 0
        total_skipped = 0
        failed_posts = []

        for i, post in enumerate(posts, 1):
            stats = migrate_post(post, db)
            total_chunks += stats["chunks"]
            total_new_embeddings += stats["new_embeddings"]
            total_skipped += stats["skipped"]
            if stats["failed"]:
                failed_posts.append(post.id)

            if i % 10 == 0 or i == len(posts):
                logger.info(
                    "Progress: %d/%d posts | chunks=%d | new_embeddings=%d | skipped=%d | failed=%d",
                    i, len(posts), total_chunks, total_new_embeddings, total_skipped, len(failed_posts),
                )

        logger.info("=" * 60)
        logger.info("Migration complete!")
        logger.info("Total posts: %d", len(posts))
        logger.info("Total chunks: %d", total_chunks)
        logger.info("New embeddings: %d", total_new_embeddings)
        logger.info("Skipped (unchanged): %d", total_skipped)
        logger.info("Failed posts: %s", failed_posts if failed_posts else "none")
        logger.info("Vector store total count: %d", vs.count())

    finally:
        db.close()


if __name__ == "__main__":
    main()
