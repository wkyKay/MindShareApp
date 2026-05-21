from typing import Optional

from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..models import User
from ..schemas import PageResponse, UserPrivate, UserPublic, UserUpdate

router = APIRouter()


@router.get("/{user_id}", response_model=UserPublic)
def get_user(user_id: int) -> UserPublic:
    # TODO: Load public profile and counts from database.
    return UserPublic(
        id=user_id,
        username="alice",
        display_name="Alice",
        avatar_url=None,
        bio="同人创作者",
    )


@router.patch("/me", response_model=UserPrivate)
def update_me(
    payload: UserUpdate, current_user: User = Depends(get_current_user)
) -> UserPrivate:
    return UserPrivate(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        display_name=payload.display_name or current_user.display_name,
        avatar_url=None,
        bio=payload.bio if payload.bio is not None else current_user.bio,
    )


@router.get("/me/posts", response_model=PageResponse)
def get_my_posts(
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
) -> PageResponse:
    return PageResponse(items=[], page=page, page_size=page_size, total=0)


@router.get("/me/collections", response_model=PageResponse)
def get_my_collections(
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
) -> PageResponse:
    return PageResponse(items=[], page=page, page_size=page_size, total=0)
