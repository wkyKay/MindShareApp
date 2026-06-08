from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Collection, Comment, ConversationParticipant, Message, Post, TranslationCache, User
from ..schemas import TranslationContentRequest, TranslationContentResponse

router = APIRouter()

SUPPORTED_CONTENT_FIELDS: dict[str, set[str]] = {
    "post": {"title", "body", "summary"},
    "comment": {"body"},
    "message": {"body"},
    "collection": {"title", "description"},
}


@router.post("/content", response_model=TranslationContentResponse)
def translate_content(
    payload: TranslationContentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TranslationContentResponse:
    content_type = payload.content_type.strip().lower()
    field = payload.field.strip().lower()
    target_language = payload.target_language.strip()
    source_language = payload.source_language.strip() or "auto"

    if content_type not in SUPPORTED_CONTENT_FIELDS or field not in SUPPORTED_CONTENT_FIELDS[content_type]:
        raise HTTPException(status_code=400, detail="不支持翻译该内容字段")
    if not target_language:
        raise HTTPException(status_code=400, detail="目标语言不能为空")

    source_text = _get_source_text(db, current_user, content_type, payload.content_id, field)
    if not source_text.strip():
        raise HTTPException(status_code=400, detail="待翻译内容为空")

    source_text_hash = sha256(source_text.encode("utf-8")).hexdigest()
    cached = (
        db.query(TranslationCache)
        .filter(
            TranslationCache.content_type == content_type,
            TranslationCache.content_id == payload.content_id,
            TranslationCache.field == field,
            TranslationCache.source_text_hash == source_text_hash,
            TranslationCache.target_language == target_language,
        )
        .first()
    )
    if cached is not None:
        return _translation_response(cached, cached=True)

    translated_text = _translate_mock(source_text, target_language)
    cache = TranslationCache(
        content_type=content_type,
        content_id=payload.content_id,
        field=field,
        source_text_hash=source_text_hash,
        source_language=source_language,
        target_language=target_language,
        translated_text=translated_text,
        provider="mock",
    )
    db.add(cache)
    db.commit()
    db.refresh(cache)
    return _translation_response(cache, cached=False)


def _get_source_text(db: Session, current_user: User, content_type: str, content_id: int, field: str) -> str:
    if content_type == "post":
        post = db.query(Post).filter(Post.id == content_id, Post.status != "deleted").first()
        if post is None:
            raise HTTPException(status_code=404, detail="博客不存在")
        if post.visibility == "private" and post.author_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权翻译该博客")
        if post.status != "published" and post.author_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权翻译该博客")
        return str(getattr(post, field) or "")

    if content_type == "comment":
        comment = db.query(Comment).filter(Comment.id == content_id, Comment.status == "published").first()
        if comment is None:
            raise HTTPException(status_code=404, detail="评论不存在")
        post = db.query(Post).filter(Post.id == comment.post_id, Post.status != "deleted").first()
        if post is None:
            raise HTTPException(status_code=404, detail="博客不存在")
        if post.visibility == "private" and post.author_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权翻译该评论")
        return comment.body

    if content_type == "message":
        message = db.query(Message).filter(Message.id == content_id, Message.status == "sent").first()
        if message is None:
            raise HTTPException(status_code=404, detail="消息不存在")
        _require_conversation_participant(db, message.conversation_id, current_user.id)
        return message.body

    if content_type == "collection":
        collection = db.query(Collection).filter(Collection.id == content_id, Collection.status != "deleted").first()
        if collection is None:
            raise HTTPException(status_code=404, detail="合集不存在")
        if collection.visibility == "private" and collection.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权翻译该合集")
        return str(getattr(collection, field) or "")

    raise HTTPException(status_code=400, detail="不支持翻译该内容类型")


def _require_conversation_participant(db: Session, conversation_id: int, user_id: int) -> None:
    participant = (
        db.query(ConversationParticipant.id)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
            ConversationParticipant.is_hidden == False,
        )
        .first()
    )
    if participant is None:
        raise HTTPException(status_code=403, detail="无权翻译该消息")


def _translate_mock(source_text: str, target_language: str) -> str:
    return f"[{target_language}] {source_text}"


def _translation_response(cache: TranslationCache, cached: bool) -> TranslationContentResponse:
    return TranslationContentResponse(
        content_type=cache.content_type,
        content_id=cache.content_id,
        field=cache.field,
        source_language=cache.source_language,
        target_language=cache.target_language,
        translated_text=cache.translated_text,
        provider=cache.provider,
        cached=cached,
    )
