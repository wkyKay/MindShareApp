import asyncio
from typing import Optional

from sqlalchemy.orm import Session

from .models import Notification, Post, User
from .realtime import realtime_manager
from .schemas import AuthorSummary


def create_notification(
    db: Session,
    *,
    recipient_id: int,
    actor_id: int,
    type: str,
    post_id: int = 0,
    post_title: Optional[str] = None,
    comment_id: int = 0,
    parent_comment_id: Optional[int] = None,
    target_user_id: Optional[int] = None,
) -> Optional[Notification]:
    if recipient_id == actor_id:
        return None
    notification = Notification(
        recipient_id=recipient_id,
        actor_id=actor_id,
        post_id=post_id,
        comment_id=comment_id,
        parent_comment_id=parent_comment_id,
        target_user_id=target_user_id,
        type=type,
    )
    if post_title is not None:
        setattr(notification, "post_title", post_title)
    db.add(notification)
    return notification


def push_notification(notification: Notification, actor: User, post_title: Optional[str] = None) -> None:
    if post_title is None and notification.post_id > 0:
        # Realtime payloads include the same post title as list API.
        post_title = getattr(notification, "post_title", None)
    event = {
        "type": "notification.created",
        "notification": {
            "id": notification.id,
            "type": notification.type,
            "recipient_id": notification.recipient_id,
            "actor": AuthorSummary(id=actor.id, display_name=actor.display_name, avatar_url=None).model_dump(),
            "post_id": notification.post_id,
            "post_title": post_title,
            "comment_id": notification.comment_id,
            "parent_comment_id": notification.parent_comment_id,
            "target_user_id": notification.target_user_id,
            "is_read": notification.is_read,
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
        },
    }
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(realtime_manager.send_to_user(notification.recipient_id, event))
    except RuntimeError:
        pass


def attach_notification_post_titles(db: Session, notifications: list[Notification]) -> None:
    post_ids = sorted({notification.post_id for notification in notifications if notification.post_id > 0})
    if not post_ids:
        return
    post_rows = db.query(Post.id, Post.title).filter(Post.id.in_(post_ids)).all()
    post_titles = {post_id: title for post_id, title in post_rows}
    for notification in notifications:
        notification.post_title = post_titles.get(notification.post_id)


def delete_unread_notification(
    db: Session,
    *,
    recipient_id: int,
    actor_id: int,
    type: str,
    post_id: Optional[int] = None,
    comment_id: Optional[int] = None,
    target_user_id: Optional[int] = None,
) -> None:
    query = db.query(Notification).filter(
        Notification.recipient_id == recipient_id,
        Notification.actor_id == actor_id,
        Notification.type == type,
        Notification.is_read.is_(False),
    )
    if post_id is not None:
        query = query.filter(Notification.post_id == post_id)
    if comment_id is not None:
        query = query.filter(Notification.comment_id == comment_id)
    if target_user_id is not None:
        query = query.filter(Notification.target_user_id == target_user_id)
    query.delete(synchronize_session=False)
