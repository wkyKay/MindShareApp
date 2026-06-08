from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_optional_current_user, hash_password
from ..database import get_db
from ..models import Asset, Collection, CollectionFavorite, Favorite, Follow, Like, Post, PostTag, Tag, User
from ..notification_service import create_notification, delete_unread_notification, push_notification
from ..schemas import AuthorSummary, FollowRequest, FollowResponse, PageResponse, PostListItem, UserPrivate, UserPublic, UserSearchResult, UserUpdate

router = APIRouter()


def _asset_url(db: Session, asset_id: Optional[int]) -> Optional[str]:
    if not asset_id:
        return None
    return db.query(Asset.public_url).filter(Asset.id == asset_id).scalar()


def _user_private(user: User, db: Session) -> UserPrivate:
    return UserPrivate(
        id=user.id,
        username=user.username,
        email=user.email,
        display_name=user.display_name,
        avatar_url=_asset_url(db, user.avatar_asset_id),
        background_url=_asset_url(db, user.background_asset_id),
        bio=user.bio,
    )


def _require_user_asset(db: Session, asset_id: int, user_id: int, kinds: set[str]) -> Asset:
    asset = db.query(Asset).filter(Asset.id == asset_id, Asset.uploader_id == user_id).first()
    if asset is None or asset.kind not in kinds:
        raise HTTPException(status_code=400, detail="图片资源无效")
    return asset


@router.get("/search", response_model=list[UserSearchResult])
def search_users(
    q: str = "",
    limit: int = 20,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> list[UserSearchResult]:
    query = db.query(User).filter(User.status == "active")
    normalized = q.strip().lower()
    if normalized:
        query = query.filter(
            (func.lower(User.username).contains(normalized)) | (func.lower(User.display_name).contains(normalized))
        )
    rows = query.order_by(User.created_at.desc()).limit(limit).all()
    return [
        UserSearchResult(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            avatar_url=None,
            bio=user.bio,
            is_following=current_user is not None and db.query(Follow.id).filter(
                Follow.follower_id == current_user.id,
                Follow.following_id == user.id,
            ).first() is not None,
        )
        for user in rows
    ]


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
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserPrivate:
    username = payload.username.strip() if payload.username is not None else None
    email = str(payload.email).strip().lower() if payload.email is not None else None
    display_name = payload.display_name.strip() if payload.display_name is not None else None

    if payload.username is not None and not username:
        raise HTTPException(status_code=400, detail="用户名不能为空")
    if payload.display_name is not None and not display_name:
        raise HTTPException(status_code=400, detail="展示昵称不能为空")

    if username and username != current_user.username:
        existing = db.query(User.id).filter(User.username == username, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="用户名已存在")
        current_user.username = username

    if email and email != current_user.email:
        existing = db.query(User.id).filter(User.email == email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="邮箱已存在")
        current_user.email = email

    if display_name is not None:
        current_user.display_name = display_name
    if payload.bio is not None:
        current_user.bio = payload.bio.strip() or None
    if payload.avatar_asset_id is not None:
        _require_user_asset(db, payload.avatar_asset_id, current_user.id, {"avatar", "image"})
        current_user.avatar_asset_id = payload.avatar_asset_id
    if payload.background_asset_id is not None:
        _require_user_asset(db, payload.background_asset_id, current_user.id, {"cover", "image"})
        current_user.background_asset_id = payload.background_asset_id
    if payload.password:
        current_user.password_hash = hash_password(payload.password)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="用户名或邮箱已存在") from None
    db.refresh(current_user)
    return _user_private(current_user, db)


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
    post_query = (
        db.query(Post, User)
        .join(Favorite, Favorite.post_id == Post.id)
        .join(User, User.id == Post.author_id)
        .filter(Favorite.user_id == current_user.id, Post.status.in_(["published", "deleted"]))
    )
    collection_query = (
        db.query(Collection, User)
        .join(CollectionFavorite, CollectionFavorite.collection_id == Collection.id)
        .join(User, User.id == Collection.owner_id)
        .filter(CollectionFavorite.user_id == current_user.id, Collection.status != "deleted")
    )
    post_rows = [(favorite.created_at, "post", post, author) for post, author, favorite in post_query.add_entity(Favorite).all()]
    collection_rows = [
        (favorite.created_at, "collection", collection, owner)
        for collection, owner, favorite in collection_query.add_entity(CollectionFavorite).all()
    ]
    rows = sorted([*post_rows, *collection_rows], key=lambda row: row[0], reverse=True)
    total = len(rows)
    page_rows = rows[(page - 1) * page_size : page * page_size]
    items = []
    for _, item_type, item, owner in page_rows:
        if item_type == "post":
            post_item = _post_item(item, owner, db, current_user).model_dump()
            post_item["favorite_type"] = "post"
            items.append(post_item)
        else:
            items.append(
                {
                    "favorite_type": "collection",
                    "id": item.id,
                    "title": item.title,
                    "description": item.description,
                    "cover_url": None,
                    "item_count": item.item_count,
                    "is_favorited": True,
                    "owner": {"id": owner.id, "display_name": owner.display_name, "avatar_url": None},
                }
            )
    return PageResponse(
        items=items,
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
                "is_favorited": db.query(CollectionFavorite.id).filter(
                    CollectionFavorite.user_id == current_user.id,
                    CollectionFavorite.collection_id == collection.id,
                ).first() is not None,
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
    notification = None
    if payload.following and follow is None:
        db.add(Follow(follower_id=current_user.id, following_id=user_id))
        notification = create_notification(
            db,
            recipient_id=user_id,
            actor_id=current_user.id,
            type="user_followed",
            target_user_id=user_id,
        )
    elif not payload.following and follow is not None:
        db.delete(follow)
        delete_unread_notification(
            db,
            recipient_id=user_id,
            actor_id=current_user.id,
            type="user_followed",
            target_user_id=user_id,
        )
    db.commit()
    if notification is not None:
        push_notification(notification, current_user)
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
    current_user: Optional[User] = Depends(get_optional_current_user),
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
                "is_favorited": current_user is not None and db.query(CollectionFavorite.id).filter(
                    CollectionFavorite.user_id == current_user.id,
                    CollectionFavorite.collection_id == collection.id,
                ).first() is not None,
            }
            for collection in collections
        ],
        page=page,
        page_size=page_size,
        total=total,
    )
