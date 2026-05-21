from datetime import datetime

from fastapi import APIRouter, Depends, status

from ..auth import get_current_user
from ..models import User
from ..schemas import (
    AuthorSummary,
    FavoriteRequest,
    FavoriteResponse,
    LikeRequest,
    LikeResponse,
    PageResponse,
    PostCreate,
    PostCreated,
    PostDetail,
    PostUpdate,
)

router = APIRouter()


@router.post("", response_model=PostCreated, status_code=status.HTTP_201_CREATED)
def create_post(payload: PostCreate, current_user: User = Depends(get_current_user)) -> PostCreated:
    return PostCreated(
        id=1,
        title=payload.title,
        status=payload.status,
        visibility=payload.visibility,
        created_at=datetime.utcnow(),
    )


@router.get("", response_model=PageResponse)
def list_posts(
    tab: str = "discover",
    tag: str | None = None,
    author_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
) -> PageResponse:
    return PageResponse(items=[], page=page, page_size=page_size, total=0)


@router.get("/{post_id}", response_model=PostDetail)
def get_post(post_id: int) -> PostDetail:
    now = datetime.utcnow()
    return PostDetail(
        id=post_id,
        title="示例博客",
        summary="示例摘要",
        cover_url=None,
        tags=[],
        author=AuthorSummary(id=1, display_name="Alice", avatar_url=None),
        like_count=0,
        comment_count=0,
        favorite_count=0,
        is_liked=False,
        is_favorited=False,
        created_at=now,
        body="示例正文",
        image_urls=[],
        updated_at=now,
    )


@router.patch("/{post_id}", response_model=PostCreated)
def update_post(
    post_id: int, payload: PostUpdate, current_user: User = Depends(get_current_user)
) -> PostCreated:
    return PostCreated(
        id=post_id,
        title=payload.title or "示例博客",
        status=payload.status or "published",
        visibility=payload.visibility or "public",
        created_at=datetime.utcnow(),
    )


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, current_user: User = Depends(get_current_user)) -> None:
    return None


@router.post("/{post_id}/like", response_model=LikeResponse)
def toggle_like(
    post_id: int, payload: LikeRequest, current_user: User = Depends(get_current_user)
) -> LikeResponse:
    return LikeResponse(liked=payload.liked, like_count=1 if payload.liked else 0)


@router.post("/{post_id}/favorite", response_model=FavoriteResponse)
def toggle_favorite(
    post_id: int, payload: FavoriteRequest, current_user: User = Depends(get_current_user)
) -> FavoriteResponse:
    return FavoriteResponse(favorited=payload.favorited, favorite_count=1 if payload.favorited else 0)
