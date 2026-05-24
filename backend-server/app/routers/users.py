from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_optional_current_user
from ..database import get_db
from ..models import Asset, Collection, Favorite, Follow, Like, Post, PostTag, Tag, User
from ..schemas import AuthorSummary, FollowRequest, FollowResponse, PageResponse, PostListItem, UserPrivate, UserPublic, UserUpdate

router = APIRouter()


def _post_item(post: Post, author: User, db: Session, current_user: Optional[User]) -> PostListItem:
    is_deleted = post.status == "deleted"
    if is_deleted:
        return PostListItem(
            id=post.id,
            title="该博客已删除",
            summary=None,
            cover_url=None,
            tags=[],
            status=post.status,
            author=AuthorSummary(id=author.id, display_name="已删除", avatar_url=None),
            like_count=0,
            comment_count=0,
            favorite_count=0,
            is_liked=False,
            is_favorited=True,
            is_deleted=True,
            is_owner=current_user is not None and post.author_id == current_user.id,
            created_at=post.created_at,
        )

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
        is_liked=current_user is not None and db.query(Like.id)
        .filter(Like.user_id == current_user.id, Like.post_id == post.id)
        .first()
        is not None,
        is_favorited=current_user is not None and db.query(Favorite.id)
        .filter(Favorite.user_id == current_user.id, Favorite.post_id == post.id)
        .first()
        is not None,
        is_deleted=False,
        is_owner=current_user is not None and post.author_id == current_user.id,
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
        .filter(Favorite.user_id == current_user.id, Post.status.in_(["published", "deleted"]))
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


@router.get("/me/following", response_model=PageResponse)
def get_my_following(
    page: int = 1,
    page_size: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PageResponse:
    query = (
        db.query(User, Follow)
        .join(Follow, Follow.following_id == User.id)
        .filter(Follow.follower_id == current_user.id, User.status == "active")
    )
    total = query.with_entities(func.count(User.id)).scalar() or 0
    rows = query.order_by(Follow.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PageResponse(
        items=[
            UserPublic(
                id=user.id,
                username=user.username,
                display_name=user.display_name,
                avatar_url=None,
                bio=user.bio,
                is_following=True,
            )
            for user, _follow in rows
        ],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{user_id}", response_model=UserPublic)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> UserPublic:
    user = db.query(User).filter(User.id == user_id, User.status == "active").first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    is_following = current_user is not None and db.query(Follow.id).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == user_id,
    ).first() is not None
    return UserPublic(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar_url=None,
        bio=user.bio,
        is_following=is_following,
    )


@router.post("/{user_id}/follow", response_model=FollowResponse)
def toggle_follow(
    user_id: int,
    payload: FollowRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FollowResponse:
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能关注自己")
    target = db.query(User).filter(User.id == user_id, User.status == "active").first()
    if not target:
        raise HTTPException(status_code=404, detail="用户不存在")

    follow = db.query(Follow).filter(
        Follow.follower_id == current_user.id,
        Follow.following_id == user_id,
    ).first()
    if payload.following and follow is None:
        db.add(Follow(follower_id=current_user.id, following_id=user_id))
    elif not payload.following and follow is not None:
        db.delete(follow)
    db.commit()
    return FollowResponse(following=payload.following)


@router.get("/{user_id}/posts", response_model=PageResponse)
def get_user_posts(
    user_id: int,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> PageResponse:
    user = db.query(User).filter(User.id == user_id, User.status == "active").first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    query = (
        db.query(Post)
        .filter(Post.author_id == user_id, Post.status.in_(["published", "deleted"]))
    )
    total = query.with_entities(func.count(Post.id)).scalar() or 0
    posts = (
        query.order_by(Post.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PageResponse(
        items=[_post_item(post, user, db, current_user) for post in posts],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{user_id}/collections", response_model=PageResponse)
def get_user_collections(
    user_id: int,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
) -> PageResponse:
    user = db.query(User).filter(User.id == user_id, User.status == "active").first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    query = db.query(Collection).filter(
        Collection.owner_id == user_id,
        Collection.visibility == "public",
        Collection.status != "deleted",
    )
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
