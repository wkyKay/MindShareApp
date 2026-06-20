from typing import Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import ALGORITHM, SECRET_KEY, get_current_user
from ..cache import get_unread_count as _cache_get_unread_count
from ..cache import invalidate_unread_count as _cache_invalidate_unread
from ..cache import set_unread_count as _cache_set_unread
from ..database import get_db
from ..models import Notification, User
from ..notification_service import attach_notification_post_titles
from ..realtime import realtime_manager
from ..schemas import AuthorSummary, NotificationOut, NotificationPostUnreadCount, NotificationReadRequest, NotificationUnreadCount, PageResponse

router = APIRouter()


@router.get("/unread-count", response_model=NotificationUnreadCount)
def get_unread_count(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> NotificationUnreadCount:
    cached = _cache_get_unread_count(current_user.id)
    if cached is not None:
        return NotificationUnreadCount(unread_count=cached)
    unread_count = db.query(func.count(Notification.id)).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read.is_(False),
    ).scalar() or 0
    _cache_set_unread(current_user.id, unread_count)
    return NotificationUnreadCount(unread_count=unread_count)


@router.get("", response_model=PageResponse)
def list_notifications(
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PageResponse:
    query = (
        db.query(Notification, User)
        .join(User, User.id == Notification.actor_id)
        .filter(Notification.recipient_id == current_user.id)
    )
    total = query.with_entities(func.count(Notification.id)).scalar() or 0
    rows = query.order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    attach_notification_post_titles(db, [notification for notification, _actor in rows])
    return PageResponse(
        items=[_notification_out(notification, actor) for notification, actor in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/posts/unread", response_model=list[NotificationPostUnreadCount])
def get_post_unread_counts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[NotificationPostUnreadCount]:
    rows = (
        db.query(Notification.post_id, func.count(Notification.id))
        .filter(Notification.recipient_id == current_user.id, Notification.is_read.is_(False), Notification.post_id > 0)
        .group_by(Notification.post_id)
        .all()
    )
    return [NotificationPostUnreadCount(post_id=post_id, unread_count=count) for post_id, count in rows]


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_notifications_read(
    payload: NotificationReadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    query = db.query(Notification).filter(Notification.recipient_id == current_user.id, Notification.is_read.is_(False))
    if payload.notification_id is not None:
        query = query.filter(Notification.id == payload.notification_id)
    if payload.post_id is not None:
        query = query.filter(Notification.post_id == payload.post_id)
    query.update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    _cache_invalidate_unread(current_user.id)
    return None


@router.websocket("/ws")
async def notifications_ws(websocket: WebSocket, db: Session = Depends(get_db)) -> None:
    token = websocket.query_params.get("token")
    user = _get_user_from_token(token, db)
    if user is None:
        await websocket.close(code=4401)
        return
    await realtime_manager.connect(user.id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_manager.disconnect(user.id, websocket)
    except Exception:
        realtime_manager.disconnect(user.id, websocket)


def _notification_out(notification: Notification, actor: User) -> NotificationOut:
    return NotificationOut(
        id=notification.id,
        type=notification.type,
        recipient_id=notification.recipient_id,
        actor=AuthorSummary(id=actor.id, display_name=actor.display_name, avatar_url=None),
        post_id=notification.post_id,
        post_title=getattr(notification, "post_title", None),
        comment_id=notification.comment_id,
        parent_comment_id=notification.parent_comment_id,
        target_user_id=notification.target_user_id,
        is_read=notification.is_read,
        created_at=notification.created_at,
    )


def _get_user_from_token(token: Optional[str], db: Session) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        subject = payload.get("sub")
        user_id = int(subject) if subject else None
    except (JWTError, ValueError):
        return None
    if user_id is None:
        return None
    return db.query(User).filter(User.id == user_id, User.status == "active").first()
