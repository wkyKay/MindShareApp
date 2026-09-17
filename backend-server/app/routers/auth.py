from datetime import datetime, timezone
import random
import string
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import create_access_token, create_refresh_token, get_current_user, hash_password, validate_refresh_token, verify_password
from ..cache import CAPTCHA_MAX_ATTEMPTS, CAPTCHA_TTL, get_captcha as cache_get_captcha, increment_captcha_attempts, mark_captcha_used, set_captcha
from ..database import get_db
from ..models import Asset, RefreshToken, User
from ..schemas import CaptchaResponse, LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserPrivate

router = APIRouter()


def _asset_url(db: Session, asset_id: Optional[int]) -> Optional[str]:
    if not asset_id:
        return None
    return db.query(Asset.public_url).filter(Asset.id == asset_id).scalar()


def _user_response(user: User, db: Session) -> UserPrivate:
    return UserPrivate(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        avatar_url=_asset_url(db, user.avatar_asset_id),
        background_url=_asset_url(db, user.background_asset_id),
        bio=user.bio,
    )


def _normalize_username(value: str) -> str:
    return value.strip()


def _normalize_email(value: str) -> str:
    return value.strip().lower()


def _normalize_captcha_code(value: str) -> str:
    return value.strip().upper()


def _verify_captcha(db: Session, captcha_key: str, captcha_code: str, purpose: str) -> None:
    captcha = cache_get_captcha(captcha_key)

    if captcha is None or captcha["purpose"] != purpose or captcha["used"]:
        raise HTTPException(status_code=400, detail="验证码无效或已过期")

    if captcha["failed_attempts"] >= CAPTCHA_MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail="验证码错误次数过多，请刷新后重试")

    if not verify_password(_normalize_captcha_code(captcha_code), captcha["code_hash"]):
        increment_captcha_attempts(captcha_key)
        raise HTTPException(status_code=400, detail="验证码错误")

    mark_captcha_used(captcha_key)


@router.get("/captcha", response_model=CaptchaResponse)
def get_captcha(purpose: str) -> CaptchaResponse:
    if purpose not in {"register", "login"}:
        raise HTTPException(status_code=400, detail="Invalid captcha purpose")
    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    captcha_id = uuid4().hex
    set_captcha(captcha_id, hash_password(code), purpose)

    return CaptchaResponse(
        captcha_key=captcha_id,
        image_url=f"/api/v1/auth/captcha/{captcha_id}/image",
        expires_in=CAPTCHA_TTL,
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

    return TokenResponse(
        user=_user_response(user, db),
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id, db),
    )


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

    return TokenResponse(
        user=_user_response(user, db),
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id, db),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    stored = validate_refresh_token(payload.refresh_token, db)
    if stored is None:
        raise HTTPException(status_code=401, detail="Refresh token 无效或已过期")

    # Refresh Token Rotation：撤销旧 token，生成新 token
    stored.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()

    user = db.query(User).filter(User.id == stored.user_id, User.status == "active").first()
    if user is None:
        raise HTTPException(status_code=401, detail="用户不存在或已禁用")

    return TokenResponse(
        user=_user_response(user, db),
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id, db),
    )


@router.get("/me", response_model=UserPrivate)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserPrivate:
    return _user_response(current_user, db)
