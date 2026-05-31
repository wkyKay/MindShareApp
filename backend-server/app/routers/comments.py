from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_optional_current_user
from ..database import get_db
from ..models import Comment, CommentLike, Notification, Post, User
from ..notification_service import create_notification, delete_unread_notification, push_notification
from ..schemas import AuthorSummary, CommentCreate, CommentLikeRequest, CommentLikeResponse, CommentResponse, PageResponse

router = APIRouter()


@router.get("/posts/{post_id}/comments", response_model=PageResponse)
def list_comments(
    post_id: int,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> PageResponse:
    post = db.query(Post.id).filter(Post.id == post_id, Post.status != "deleted").first()
    if post is None:
        raise HTTPException(status_code=404, detail="博客不存在")
    query = (
        db.query(Comment, User)
        .join(User, User.id == Comment.author_id)
        .filter(Comment.post_id == post_id, Comment.status == "published")
    )
    total = query.with_entities(func.count(Comment.id)).scalar() or 0
    rows = (
        query.order_by(Comment.created_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PageResponse(
        items=[_comment_response(comment, author, db, current_user) for comment, author in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int,
    payload: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentResponse:
    post = db.query(Post).filter(Post.id == post_id, Post.status != "deleted").first()
    if post is None:
        raise HTTPException(status_code=404, detail="博客不存在")
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="评论不能为空")
    if payload.parent_id is not None:
        parent = db.query(Comment).filter(
            Comment.id == payload.parent_id,
            Comment.post_id == post_id,
            Comment.status == "published",
        ).first()
        if parent is None:
            raise HTTPException(status_code=404, detail="回复的评论不存在")

    comment = Comment(post_id=post_id, author_id=current_user.id, parent_id=payload.parent_id, body=body)
    db.add(comment)
    post.comment_count += 1
    db.flush()
    for notification in _build_comment_notifications(post, comment, current_user, db):
        db.add(notification)
    db.commit()
    db.refresh(comment)
    _push_comment_notifications(post, comment, current_user, db)
    return _comment_response(comment, current_user, db, current_user)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.status == "published").first()
    if comment is None:
        return None
    post = db.query(Post).filter(Post.id == comment.post_id).first()
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除该评论")
    comments_to_delete = _collect_comment_descendants(db, comment) if comment.parent_id is None else [comment]
    comment_ids = [item.id for item in comments_to_delete]
    if comment.parent_id is not None:
        db.query(Comment).filter(
            Comment.parent_id == comment.id,
            Comment.status == "published",
        ).update({Comment.parent_id: comment.parent_id}, synchronize_session=False)
    for item in comments_to_delete:
        item.status = "deleted"
    if comment_ids:
        db.query(CommentLike).filter(CommentLike.comment_id.in_(comment_ids)).delete(synchronize_session=False)
    if post is not None:
        post.comment_count = max(0, post.comment_count - len(comments_to_delete))
    db.commit()
    return None


@router.post("/comments/{comment_id}/like", response_model=CommentLikeResponse)
def toggle_comment_like(
    comment_id: int,
    payload: CommentLikeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentLikeResponse:
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.status == "published").first()
    if comment is None:
        raise HTTPException(status_code=404, detail="评论不存在")
    like = db.query(CommentLike).filter(
        CommentLike.user_id == current_user.id,
        CommentLike.comment_id == comment_id,
    ).first()
    if payload.liked and like is None:
        db.add(CommentLike(user_id=current_user.id, comment_id=comment_id))
        comment.like_count += 1
        if comment.author_id != current_user.id:
            create_notification(
                db,
                recipient_id=comment.author_id,
                actor_id=current_user.id,
                type="comment_liked",
                post_id=comment.post_id,
                post_title=db.query(Post.title).filter(Post.id == comment.post_id).scalar(),
                comment_id=comment.id,
            )
    elif not payload.liked and like is not None:
        db.delete(like)
        comment.like_count = max(0, comment.like_count - 1)
        delete_unread_notification(
            db,
            recipient_id=comment.author_id,
            actor_id=current_user.id,
            type="comment_liked",
            post_id=comment.post_id,
            comment_id=comment.id,
        )
    db.commit()
    db.refresh(comment)
    if payload.liked:
        notifications = db.query(Notification).filter(
            Notification.recipient_id == comment.author_id,
            Notification.actor_id == current_user.id,
            Notification.type == "comment_liked",
            Notification.comment_id == comment.id,
        ).order_by(Notification.id.desc()).all()
        if notifications:
            push_notification(notifications[0], current_user)
    return CommentLikeResponse(liked=payload.liked, like_count=comment.like_count)


def _comment_response(comment: Comment, author: User, db: Session, current_user: Optional[User]) -> CommentResponse:
    return CommentResponse(
        id=comment.id,
        body=comment.body,
        author=AuthorSummary(id=author.id, display_name=author.display_name, avatar_url=None),
        parent_id=comment.parent_id,
        created_at=comment.created_at,
        like_count=comment.like_count,
        is_liked=current_user is not None and db.query(CommentLike.id).filter(
            CommentLike.user_id == current_user.id,
            CommentLike.comment_id == comment.id,
        ).first() is not None,
    )


def _collect_comment_descendants(db: Session, comment: Comment) -> list[Comment]:
    collected = [comment]
    pending_ids = [comment.id]
    while pending_ids:
        children = db.query(Comment).filter(
            Comment.parent_id.in_(pending_ids),
            Comment.status == "published",
        ).all()
        collected.extend(children)
        pending_ids = [child.id for child in children]
    return collected


def _build_comment_notifications(post: Post, comment: Comment, current_user: User, db: Session) -> list[Notification]:
    notifications: list[Notification] = []
    recipient_ids: set[int] = set()
    if post.author_id != current_user.id:
        recipient_ids.add(post.author_id)
        notification = create_notification(
            db,
            recipient_id=post.author_id,
            actor_id=current_user.id,
            post_id=post.id,
            post_title=post.title,
            comment_id=comment.id,
            parent_comment_id=comment.parent_id,
            type="comment_created" if comment.parent_id is None else "comment_reply",
        )
        if notification is not None:
            notifications.append(notification)
    if comment.parent_id is not None:
        parent_author_id = db.query(Comment.author_id).filter(Comment.id == comment.parent_id).scalar()
        if parent_author_id and parent_author_id != current_user.id and parent_author_id not in recipient_ids:
            notification = create_notification(
                db,
                recipient_id=parent_author_id,
                actor_id=current_user.id,
                post_id=post.id,
                post_title=post.title,
                comment_id=comment.id,
                parent_comment_id=comment.parent_id,
                type="comment_reply",
            )
            if notification is not None:
                notifications.append(notification)
    return notifications


def _push_comment_notifications(post: Post, comment: Comment, current_user: User, db: Session) -> None:
    notifications = db.query(Notification).filter(Notification.comment_id == comment.id).all()
    for notification in notifications:
        push_notification(notification, current_user)
