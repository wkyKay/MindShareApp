from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import Optional

from ..auth import ALGORITHM, SECRET_KEY, get_current_user
from ..database import get_db
from ..models import Conversation, ConversationParticipant, Message, User
from ..realtime import realtime_manager
from ..schemas import (
    ConversationCreate,
    ConversationListItem,
    ConversationOut,
    ConversationUnreadCount,
    ConversationUserSummary,
    MessageCreate,
    MessageOut,
)

router = APIRouter()


@router.get("/unread-count", response_model=ConversationUnreadCount)
def get_unread_count(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ConversationUnreadCount:
    conversation_ids = [row[0] for row in db.query(ConversationParticipant.conversation_id).filter(ConversationParticipant.user_id == current_user.id).all()]
    unread_count = sum(_unread_count(db, conversation_id, current_user.id) for conversation_id in conversation_ids)
    return ConversationUnreadCount(unread_count=unread_count)


@router.get("/conversations", response_model=list[ConversationListItem])
def list_conversations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ConversationListItem]:
    conversation_ids = [row[0] for row in db.query(ConversationParticipant.conversation_id).filter(ConversationParticipant.user_id == current_user.id).all()]
    rows = db.query(Conversation).filter(Conversation.id.in_(conversation_ids)).order_by(Conversation.updated_at.desc()).all()
    items: list[ConversationListItem] = []
    for conversation in rows:
        partner_row = (
            db.query(User)
            .join(ConversationParticipant, ConversationParticipant.user_id == User.id)
            .filter(ConversationParticipant.conversation_id == conversation.id, ConversationParticipant.user_id != current_user.id)
            .first()
        )
        if partner_row is None:
            continue
        partner = partner_row
        last_message = _message_out(db, conversation.last_message_id) if conversation.last_message_id else None
        unread_count = _unread_count(db, conversation.id, current_user.id)
        items.append(
            ConversationListItem(
                id=conversation.id,
                partner=_user_summary(partner),
                last_message=last_message,
                unread_count=unread_count,
                updated_at=conversation.updated_at,
            )
        )
    return items


@router.post("/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_or_get_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationOut:
    if payload.partner_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能给自己发私信")
    partner = db.query(User).filter(User.id == payload.partner_id, User.status == "active").first()
    if partner is None:
        raise HTTPException(status_code=404, detail="用户不存在")

    conversation = _find_or_create_conversation(db, current_user.id, partner.id)
    unread_count = _unread_count(db, conversation.id, current_user.id)
    return ConversationOut(id=conversation.id, partner=_user_summary(partner), unread_count=unread_count)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MessageOut]:
    _require_participant(db, conversation_id, current_user.id)
    messages = db.query(Message).filter(Message.conversation_id == conversation_id, Message.status == "sent").order_by(Message.created_at.asc()).all()
    return [_message_out(db, message.id) for message in messages if message.id is not None]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(
    conversation_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageOut:
    conversation = _require_participant(db, conversation_id, current_user.id)
    message = Message(conversation_id=conversation.id, sender_id=current_user.id, body=payload.body.strip())
    db.add(message)
    db.flush()
    conversation.last_message_id = message.id
    conversation.updated_at = message.created_at
    db.commit()
    db.refresh(message)
    message_out = _message_out(db, message.id)
    for participant_id in _participant_ids(db, conversation.id):
        _push_message(participant_id, message_out)
    return message_out


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def read_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    conversation = _require_participant(db, conversation_id, current_user.id)
    last_message_id = conversation.last_message_id
    participant = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == current_user.id,
    ).first()
    if participant is not None:
        participant.last_read_message_id = last_message_id
        db.commit()
        _push_conversation_read(current_user.id, conversation_id)
    return None


@router.websocket("/ws")
async def messages_ws(websocket: WebSocket, db: Session = Depends(get_db)) -> None:
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


def _find_or_create_conversation(db: Session, user_a_id: int, user_b_id: int) -> Conversation:
    rows = (
        db.query(Conversation)
        .join(ConversationParticipant, ConversationParticipant.conversation_id == Conversation.id)
        .filter(ConversationParticipant.user_id.in_([user_a_id, user_b_id]))
        .group_by(Conversation.id)
        .having(func.count(Conversation.id) == 2)
        .all()
    )
    for conversation in rows:
        participant_ids = {row[0] for row in db.query(ConversationParticipant.user_id).filter(ConversationParticipant.conversation_id == conversation.id).all()}
        if participant_ids == {user_a_id, user_b_id}:
            return conversation

    conversation = Conversation()
    db.add(conversation)
    db.flush()
    db.add_all([
        ConversationParticipant(conversation_id=conversation.id, user_id=user_a_id),
        ConversationParticipant(conversation_id=conversation.id, user_id=user_b_id),
    ])
    db.commit()
    db.refresh(conversation)
    return conversation


def _require_participant(db: Session, conversation_id: int, user_id: int) -> Conversation:
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    participant = db.query(ConversationParticipant.id).filter(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == user_id,
    ).first()
    if participant is None:
        raise HTTPException(status_code=403, detail="无权访问该会话")
    return conversation


def _unread_count(db: Session, conversation_id: int, user_id: int) -> int:
    participant = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == user_id,
    ).first()
    if participant is None:
        return 0
    last_read = participant.last_read_message_id or 0
    return db.query(func.count(Message.id)).filter(
        Message.conversation_id == conversation_id,
        Message.id > last_read,
        Message.sender_id != user_id,
        Message.status == "sent",
    ).scalar() or 0


def _user_summary(user: User) -> ConversationUserSummary:
    return ConversationUserSummary(id=user.id, username=user.username, display_name=user.display_name, avatar_url=None)


def _message_out(db: Session, message_id: int) -> MessageOut:
    message = db.query(Message, User).join(User, User.id == Message.sender_id).filter(Message.id == message_id).first()
    if message is None:
        raise HTTPException(status_code=404, detail="消息不存在")
    row, sender = message
    return MessageOut(
        id=row.id,
        conversation_id=row.conversation_id,
        sender=_user_summary(sender),
        body=row.body,
        status=row.status,
        created_at=row.created_at,
    )


def _participant_ids(db: Session, conversation_id: int) -> list[int]:
    return [row[0] for row in db.query(ConversationParticipant.user_id).filter(ConversationParticipant.conversation_id == conversation_id).all()]


def _push_message(user_id: int, message: MessageOut) -> None:
    import asyncio

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(realtime_manager.send_to_user(user_id, {"type": "message.created", "message": message.model_dump()}))
    except RuntimeError:
        pass


def _push_conversation_read(user_id: int, conversation_id: int) -> None:
    import asyncio

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(realtime_manager.send_to_user(user_id, {"type": "conversation.read", "conversation_id": conversation_id}))
    except RuntimeError:
        pass


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
