from datetime import datetime, timedelta, timezone
import random
import string
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import create_access_token, get_current_user, hash_password, verify_password
from ..database import get_db
from ..models import Captcha, User
from ..schemas import CaptchaResponse, LoginRequest, RegisterRequest, TokenResponse, UserPrivate

router = APIRouter()

CAPTCHA_EXPIRE_MINUTES = 5
CAPTCHA_MAX_FAILED_ATTEMPTS = 5


def _user_response(user: User) -> UserPrivate:
    return UserPrivate(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        avatar_url=None,
        bio=user.bio,
    )


def _normalize_username(value: str) -> str:
    return value.strip()


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _normalize_captcha_code(value: str) -> str:
    return value.strip().upper()


def _verify_captcha(db: Session, captcha_key: str, captcha_code: str, purpose: str) -> None:
    captcha = db.query(Captcha).filter(Captcha.captcha_key == captcha_key).first()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if captcha is None or captcha.purpose != purpose or captcha.used_at is not None or captcha.expires_at <= now:
        raise HTTPException(status_code=400, detail="验证码无效或已过期")

    if captcha.failed_attempts >= CAPTCHA_MAX_FAILED_ATTEMPTS:
        raise HTTPException(status_code=400, detail="验证码错误次数过多，请刷新后重试")

    if not verify_password(_normalize_captcha_code(captcha_code), captcha.code_hash):
        captcha.failed_attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="验证码错误")

    captcha.used_at = now
    db.commit()


@router.get("/captcha", response_model=CaptchaResponse)
def get_captcha(purpose: str, db: Session = Depends(get_db)) -> CaptchaResponse:
    if purpose not in {"register", "login"}:
        raise HTTPException(status_code=400, detail="Invalid captcha purpose")
    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    captcha_key = f"cap_{uuid4().hex}_{code.lower()}"
    captcha = Captcha(
        captcha_key=captcha_key,
        code_hash=hash_password(code),
        purpose=purpose,
        expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=CAPTCHA_EXPIRE_MINUTES),
    )
    db.add(captcha)
    db.commit()

    return CaptchaResponse(
        captcha_key=captcha_key,
        image_url=f"/api/v1/auth/captcha/{captcha_key}/image",
        expires_in=int(timedelta(minutes=CAPTCHA_EXPIRE_MINUTES).total_seconds()),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    _verify_captcha(db, payload.captcha_key, payload.captcha_code, "register")

    username = _normalize_username(payload.username)
    email = _normalize_email(str(payload.email))
    display_name = payload.display_name.strip()

    if not username or not display_name:
        raise HTTPException(status_code=400, detail="用户名和展示昵称不能为空")

    existing_user = (
        db.query(User)
        .filter(or_(User.username == username, User.email == email))
        .first()
    )
    if existing_user:
        raise HTTPException(status_code=400, detail="用户名或邮箱已存在")

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(payload.password),
        display_name=display_name,
        status="active",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="用户名或邮箱已存在") from None
    db.refresh(user)

    return TokenResponse(user=_user_response(user), access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    _verify_captcha(db, payload.captcha_key, payload.captcha_code, "login")

    account = payload.account.strip()
    user = (
        db.query(User)
        .filter(or_(User.username == account, User.email == account.lower()))
        .first()
    )
    if user is None or user.status != "active" or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号或密码错误")

    return TokenResponse(user=_user_response(user), access_token=create_access_token(user.id))


@router.get("/me", response_model=UserPrivate)
def me(current_user: User = Depends(get_current_user)) -> UserPrivate:
    return _user_response(current_user)
