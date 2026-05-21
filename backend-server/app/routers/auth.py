from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import get_current_user
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
def register(payload: RegisterRequest) -> TokenResponse:
    # TODO: Validate captcha, hash password, persist user, and issue JWT.
    now_id = int(datetime.utcnow().timestamp())
    return TokenResponse(
        user=UserPrivate(
            id=now_id,
            username=payload.username,
            email=payload.email,
            display_name=payload.display_name,
            avatar_url=None,
            bio=None,
        ),
        access_token="development-token",
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    # TODO: Validate captcha, verify password, and issue JWT.
    return TokenResponse(
        user=UserPrivate(
            id=1,
            username=payload.account.split("@")[0],
            email=payload.account if "@" in payload.account else "user@example.com",
            display_name=payload.account.split("@")[0],
            avatar_url=None,
            bio=None,
        ),
        access_token="development-token",
    )


@router.get("/me", response_model=UserPrivate)
def me(current_user: User = Depends(get_current_user)) -> UserPrivate:
    return _user_response(current_user)
