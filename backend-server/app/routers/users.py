from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Asset, Collection, Favorite, Post, PostTag, Tag, User
from ..schemas import AuthorSummary, PageResponse, PostListItem, UserPrivate, UserPublic, UserUpdate

router = APIRouter()


def _post_item(post: Post, author: User, db: Session, current_user: User) -> PostListItem:
    tags = (
        db.query(Tag.name)
        .join(PostTag, PostTag.tag_id == Tag.id)
        .filter(PostTag.post_id == post.id)
        .all()
    )
    cover_url = None
    if post.cover_asset_id:
        cover_url = db.query(Asset.public_url).filter(Asset.id == post.cover_asset_id).scalar()

    return PostListItem(
        id=post.id,
        title=post.title,
        summary=post.summary,
        cover_url=cover_url,
        tags=[tag[0] for tag in tags],
        status=post.status,
        author=AuthorSummary(id=author.id, display_name=author.display_name, avatar_url=None),
        like_count=post.like_count,
        comment_count=post.comment_count,
        favorite_count=post.favorite_count,
        is_liked=False,
        is_favorited=db.query(Favorite.id)
        .filter(Favorite.user_id == current_user.id, Favorite.post_id == post.id)
        .first()
        is not None,
        created_at=post.created_at,
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
    db: Session = Depends(get_db),
) -> PageResponse:
    query = db.query(Post, User).join(User, User.id == Post.author_id).filter(Post.author_id == current_user.id)
    if status:
        query = query.filter(Post.status == status)
    else:
        query = query.filter(Post.status != "deleted")
    total = query.with_entities(func.count(Post.id)).scalar() or 0
    rows = (
        query.order_by(Post.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PageResponse(
        items=[_post_item(post, author, db, current_user) for post, author in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/me/favorites", response_model=PageResponse)
def get_my_favorites(
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PageResponse:
    query = (
        db.query(Post, User)
        .join(Favorite, Favorite.post_id == Post.id)
        .join(User, User.id == Post.author_id)
        .filter(Favorite.user_id == current_user.id, Post.status == "published")
    )
    total = query.with_entities(func.count(Post.id)).scalar() or 0
    rows = (
        query.order_by(Favorite.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PageResponse(
        items=[_post_item(post, author, db, current_user) for post, author in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/me/collections", response_model=PageResponse)
def get_my_collections(
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PageResponse:
    query = db.query(Collection).filter(Collection.owner_id == current_user.id, Collection.status != "deleted")
    total = query.with_entities(func.count(Collection.id)).scalar() or 0
    collections = (
        query.order_by(Collection.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PageResponse(
        items=[
            {
                "id": collection.id,
                "title": collection.title,
                "description": collection.description,
                "cover_url": None,
                "item_count": collection.item_count,
            }
            for collection in collections
        ],
        page=page,
        page_size=page_size,
        total=total,
    )


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
