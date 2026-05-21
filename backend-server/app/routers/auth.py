from datetime import timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User
from ..schemas import CaptchaResponse, LoginRequest, RegisterRequest, TokenResponse, UserPrivate

router = APIRouter()


def _user_response(user: User) -> UserPrivate:
    return UserPrivate(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        avatar_url=None,
        bio=user.bio,
    )


@router.get("/captcha", response_model=CaptchaResponse)
def get_captcha(purpose: str) -> CaptchaResponse:
    if purpose not in {"register", "login"}:
        raise HTTPException(status_code=400, detail="Invalid captcha purpose")
    captcha_key = f"cap_{uuid4().hex}"
    return CaptchaResponse(
        captcha_key=captcha_key,
        image_url=f"/api/v1/auth/captcha/{captcha_key}/image",
        expires_in=int(timedelta(minutes=5).total_seconds()),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    # TODO: Validate captcha, hash password, persist user, and issue JWT.
    existing_user = (
        db.query(User)
        .filter(or_(User.username == payload.username, User.email == payload.email))
        .first()
    )
    if existing_user:
        raise HTTPException(status_code=400, detail="用户名或邮箱已存在")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=f"development-password:{payload.password}",
        display_name=payload.display_name,
        status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(user=_user_response(user), access_token=f"development-token:{user.id}")


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    # TODO: Validate captcha, verify password, and issue JWT.
    user = (
        db.query(User)
        .filter(or_(User.username == payload.account, User.email == payload.account))
        .first()
    )
    if user is None:
        raise HTTPException(status_code=401, detail="账号或密码错误")

    return TokenResponse(user=_user_response(user), access_token=f"development-token:{user.id}")


@router.get("/me", response_model=UserPrivate)
def me(current_user: User = Depends(get_current_user)) -> UserPrivate:
    return _user_response(current_user)
