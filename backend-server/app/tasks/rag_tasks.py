import logging

from sqlalchemy.orm import Session

from ..celery_app import celery_app
from ..database import SessionLocal
from ..models import Post, TextChunk
from ..rag.chunker import split_text
from ..rag.embedder import embed_texts, serialize_embedding

logger = logging.getLogger(__name__)


@celery_app.task(
    autoretry_for=(Exception,),
    max_retries=2,
    default_retry_delay=10,
    soft_time_limit=120,
    time_limit=180,
)
def sync_post_chunks(post_id: int) -> None:
    """为指定博客重新生成所有 chunk 和 embedding。

    流程：
    1. 删除该博客的所有旧 chunk
    2. 取博客正文切分为 chunks
    3. 批量调用 Embedding API 生成向量
    4. 写入 text_chunks 表
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

        # 1. 删除旧 chunks
        _delete_chunks_for_post(db, post_id)

        # 2. 切分
        texts = split_text(body)
        if not texts:
            return

        # 3. 生成 embedding
        embeddings = embed_texts(texts)

        # 4. 写入
        for idx, text in enumerate(texts):
            chunk = TextChunk(
                post_id=post_id,
                chunk_index=idx,
                content=text,
                embedding=serialize_embedding(embeddings[idx]) if embeddings else None,
            )
            db.add(chunk)

        db.commit()
        logger.info(
            "sync_post_chunks: post %s indexed %d chunks (%s embeddings)",
            post_id,
            len(texts),
            "with" if embeddings else "without",
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
    """删除指定博客的所有 chunk。"""
    db: Session = SessionLocal()
    try:
        _delete_chunks_for_post(db, post_id)
        db.commit()
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
