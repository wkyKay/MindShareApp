from datetime import datetime, timedelta, timezone
import hashlib
import os
import secrets
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from sqlalchemy import update
from sqlalchemy.orm import Session

from . import models
from .cache import get_user_cache, set_user_cache
from .database import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(plain_password, password_hash)
    except (UnknownHashError, ValueError):
        return False


def create_access_token(user_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expires_at}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: int, db: Session) -> str:
    """创建 Refresh Token，返回明文 token，数据库只存 SHA-256 哈希。同时撤销该用户所有旧 refresh token。"""
    raw_token = secrets.token_urlsafe(64)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    # 撤销该用户所有旧的未撤销 refresh token（每次登录只保留最新一个设备的一系列 token）
    db.execute(
        update(models.RefreshToken)
        .where(
            models.RefreshToken.user_id == user_id,
            models.RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )
    db.add(models.RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at))
    db.commit()
    return raw_token


def validate_refresh_token(raw_token: str, db: Session) -> Optional[models.RefreshToken]:
    """验证 Refresh Token 是否有效，有效则返回数据库记录。"""
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    stored = db.query(models.RefreshToken).filter(
        models.RefreshToken.token_hash == token_hash,
        models.RefreshToken.revoked_at.is_(None),
        models.RefreshToken.expires_at > datetime.now(timezone.utc),
    ).first()
    return stored


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        subject = payload.get("sub")
        user_id = int(subject) if subject else None
    except (JWTError, ValueError):
        user_id = None

    if user_id is None:
        raise credentials_error

    cached = get_user_cache(user_id)
    if cached is not None:
        return models.User(**cached)

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None or user.status != "active":
        raise credentials_error

    user_data = {
        key: value
        for key, value in user.__dict__.items()
        if not key.startswith("_") and key not in ("password_hash", "email")
    }
    set_user_cache(user_id, user_data)
    return user


def get_optional_current_user(
    token: Optional[str] = Depends(optional_oauth2_scheme), db: Session = Depends(get_db)
) -> Optional[models.User]:
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

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None or user.status != "active":
        return None
    return user
