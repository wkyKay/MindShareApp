from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_optional_current_user
from ..database import get_db
from ..models import Asset, Favorite, Follow, Like, Post, PostDislike, PostTag, Tag, User
from ..notification_service import create_notification, delete_unread_notification, push_notification
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
    PostImageEntry,
    PostUpdate,
)

router = APIRouter()


def _post_detail(post: Post, author: User, db: Session, current_user: Optional[User] = None) -> PostDetail:
    tags = (
        db.query(Tag.name)
        .join(PostTag, PostTag.tag_id == Tag.id)
        .filter(PostTag.post_id == post.id)
        .all()
    )
    cover_url = None
    cover_thumbnail_url = None
    if post.cover_asset_id:
        cover_asset = db.query(Asset.public_url, Asset.storage_path).filter(Asset.id == post.cover_asset_id).first()
        if cover_asset:
            cover_url = cover_asset[0]
            if cover_asset[1] and cover_asset[1] != "database":
                cover_thumbnail_url = f"/api/v1/uploads/assets/{post.cover_asset_id}/thumbnail"
    image_rows = (
        db.query(Asset.id, Asset.public_url, Asset.storage_path)
        .filter(Asset.post_id == post.id, Asset.kind == "image", Asset.public_url.isnot(None))
        .all()
    )
    image_urls = [
        PostImageEntry(
            url=row[1],
            thumbnail_url=(
                f"/api/v1/uploads/assets/{row[0]}/thumbnail"
                if row[2] and row[2] != "database"
                else None
            ),
        )
        for row in image_rows
    ]
    if not cover_thumbnail_url and image_urls and image_urls[0].thumbnail_url:
        cover_thumbnail_url = image_urls[0].thumbnail_url

    return PostDetail(
        id=post.id,
        title=post.title,
        summary=post.summary,
        cover_url=cover_url,
        cover_thumbnail_url=cover_thumbnail_url,
        tags=[tag[0] for tag in tags],
        status=post.status,
        author=AuthorSummary(id=author.id, display_name=author.display_name, avatar_url=None),
        like_count=post.like_count,
        comment_count=post.comment_count,
        favorite_count=post.favorite_count,
        is_liked=current_user is not None
        and db.query(Like.id).filter(Like.user_id == current_user.id, Like.post_id == post.id).first() is not None,
        is_favorited=current_user is not None
        and db.query(Favorite.id).filter(Favorite.user_id == current_user.id, Favorite.post_id == post.id).first() is not None,
        is_deleted=post.status == "deleted",
        is_owner=current_user is not None and post.author_id == current_user.id,
        created_at=post.created_at,
        body=post.body,
        image_urls=image_urls,
        updated_at=post.updated_at,
    )


@router.post("", response_model=PostCreated, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostCreated:
    title = payload.title.strip()
    body = payload.body.strip()
    if not title or not body:
        raise HTTPException(status_code=400, detail="标题和正文不能为空")
    if payload.status not in {"published", "draft"}:
        raise HTTPException(status_code=400, detail="文章状态无效")
    if payload.visibility not in {"public", "private", "followers"}:
        raise HTTPException(status_code=400, detail="可见性无效")

    post = Post(
        author_id=current_user.id,
        title=title,
        body=body,
        summary=payload.summary.strip() if payload.summary else None,
        cover_asset_id=payload.cover_asset_id,
        visibility=payload.visibility,
        status=payload.status,
        published_at=datetime.utcnow() if payload.status == "published" else None,
    )
    db.add(post)
    db.flush()

    normalized_tags = []
    for tag_name in payload.tags:
        tag_name = tag_name.strip()
        if tag_name and tag_name not in normalized_tags:
            normalized_tags.append(tag_name)

    for tag_name in normalized_tags:
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if tag is None:
            tag = Tag(name=tag_name)
            db.add(tag)
            db.flush()
        db.add(PostTag(post_id=post.id, tag_id=tag.id))

    db.commit()
    db.refresh(post)

    if post.status == "published":
        from ...tasks.rag_tasks import sync_post_chunks

        sync_post_chunks.delay(post.id)

    return PostCreated(
        id=post.id,
        title=post.title,
        status=post.status,
        visibility=post.visibility,
        created_at=post.created_at,
    )


@router.get("", response_model=PageResponse)
def list_posts(
    tab: str = "discover",
    tag: Optional[str] = None,
    q: Optional[str] = None,
    author_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    seed: int = 1,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PageResponse:
    if tab == "following":
        if current_user is None:
            return PageResponse(items=[], page=page, page_size=page_size, total=0)
        query = (
            db.query(Post, User)
            .join(Follow, Follow.following_id == Post.author_id)
            .join(User, User.id == Post.author_id)
            .filter(
                Follow.follower_id == current_user.id,
                Post.status == "published",
                Post.visibility.in_(["public", "followers"]),
            )
        )
        disliked_post_ids = db.query(PostDislike.post_id).filter(PostDislike.user_id == current_user.id)
        query = query.filter(~Post.id.in_(disliked_post_ids))
        total = query.with_entities(Post.id).count()
        rows = query.order_by(Post.created_at.desc(), Post.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return PageResponse(
            items=[_post_detail(post, author, db, current_user) for post, author in rows],
            page=page,
            page_size=page_size,
            total=total,
        )

    query = db.query(Post, User).join(User, User.id == Post.author_id).filter(
        Post.status == "published", Post.visibility == "public"
    )
    if author_id:
        query = query.filter(Post.author_id == author_id)
    elif current_user is not None:
        disliked_post_ids = db.query(PostDislike.post_id).filter(PostDislike.user_id == current_user.id)
        query = query.filter(~Post.id.in_(disliked_post_ids))
    if tag:
        query = query.join(PostTag, PostTag.post_id == Post.id).join(Tag, Tag.id == PostTag.tag_id).filter(Tag.name == tag)
    normalized_query = q.strip().lower() if q else ""
    if normalized_query:
        query = query.filter(func.lower(Post.title).contains(normalized_query))
    total = query.with_entities(Post.id).count()
    random_order = ((Post.id * 1103515245 + seed) % 2147483647)
    rows = query.order_by(random_order, Post.id).offset((page - 1) * page_size).limit(page_size).all()
    return PageResponse(
        items=[_post_detail(post, author, db, current_user) for post, author in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{post_id}", response_model=PostDetail)
def get_post(
    post_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PostDetail:
    row = db.query(Post, User).join(User, User.id == Post.author_id).filter(Post.id == post_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="博客不存在")
    post, author = row
    if post.status == "deleted" and (current_user is None or current_user.id != post.author_id):
        raise HTTPException(status_code=404, detail="博客已删除")
    if post.visibility == "private" and (current_user is None or current_user.id != post.author_id):
        raise HTTPException(status_code=403, detail="无权查看该博客")
    return _post_detail(post, author, db, current_user)


@router.patch("/{post_id}", response_model=PostCreated)
def update_post(
    post_id: int,
    payload: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostCreated:
    post = db.query(Post).filter(Post.id == post_id).first()
    if post is None or post.status == "deleted":
        raise HTTPException(status_code=404, detail="博客不存在")
    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能编辑自己的博客")
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="标题不能为空")
        post.title = title
    if payload.body is not None:
        body = payload.body.strip()
        if not body:
            raise HTTPException(status_code=400, detail="正文不能为空")
        post.body = body
    if payload.summary is not None:
        post.summary = payload.summary.strip() or None
    if payload.cover_asset_id is not None:
        post.cover_asset_id = payload.cover_asset_id
    if payload.visibility is not None:
        if payload.visibility not in {"public", "private", "followers"}:
            raise HTTPException(status_code=400, detail="可见性无效")
        post.visibility = payload.visibility
    if payload.status is not None:
        if payload.status not in {"published", "draft", "archived"}:
            raise HTTPException(status_code=400, detail="文章状态无效")
        post.status = payload.status
        if payload.status == "published" and post.published_at is None:
            post.published_at = datetime.utcnow()
    if payload.tags is not None:
        db.query(PostTag).filter(PostTag.post_id == post.id).delete()
        normalized_tags = []
        for tag_name in payload.tags:
            tag_name = tag_name.strip()
            if tag_name and tag_name not in normalized_tags:
                normalized_tags.append(tag_name)
        for tag_name in normalized_tags:
            tag = db.query(Tag).filter(Tag.name == tag_name).first()
            if tag is None:
                tag = Tag(name=tag_name)
                db.add(tag)
                db.flush()
            db.add(PostTag(post_id=post.id, tag_id=tag.id))
    db.commit()
    db.refresh(post)

    if post.status == "published":
        from ...tasks.rag_tasks import sync_post_chunks

        sync_post_chunks.delay(post.id)
    elif post.status in ("draft", "archived"):
        from ...tasks.rag_tasks import delete_post_chunks

        delete_post_chunks.delay(post.id)

    return PostCreated(
        id=post.id,
        title=post.title,
        status=post.status,
        visibility=post.visibility,
        created_at=post.created_at,
    )


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    post = db.query(Post).filter(Post.id == post_id).first()
    if post is None or post.status == "deleted":
        raise HTTPException(status_code=404, detail="博客不存在")
    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能删除自己的博客")
    post.status = "deleted"
    db.commit()

    from ...tasks.rag_tasks import delete_post_chunks

    delete_post_chunks.delay(post.id)

    return None


@router.post("/{post_id}/like", response_model=LikeResponse)
def toggle_like(
    post_id: int,
    payload: LikeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LikeResponse:
    post = db.query(Post).filter(Post.id == post_id, Post.status != "deleted").first()
    if post is None:
        raise HTTPException(status_code=404, detail="博客不存在")
    like = db.query(Like).filter(Like.user_id == current_user.id, Like.post_id == post_id).first()
    if payload.liked and like is None:
        db.add(Like(user_id=current_user.id, post_id=post_id))
        post.like_count += 1
        notification = None
        if post.author_id != current_user.id:
            notification = create_notification(
                db,
                recipient_id=post.author_id,
                actor_id=current_user.id,
                type="post_liked",
                post_id=post.id,
                post_title=post.title,
            )
    elif not payload.liked and like is not None:
        db.delete(like)
        post.like_count = max(0, post.like_count - 1)
        delete_unread_notification(
            db,
            recipient_id=post.author_id,
            actor_id=current_user.id,
            type="post_liked",
            post_id=post.id,
        )
        notification = None
    else:
        notification = None
    db.commit()
    db.refresh(post)
    if notification is not None:
        push_notification(notification, current_user)
    return LikeResponse(liked=payload.liked, like_count=post.like_count)


@router.post("/{post_id}/favorite", response_model=FavoriteResponse)
def toggle_favorite(
    post_id: int,
    payload: FavoriteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FavoriteResponse:
    post = db.query(Post).filter(Post.id == post_id, Post.status != "deleted").first()
    if post is None:
        raise HTTPException(status_code=404, detail="博客不存在")
    favorite = db.query(Favorite).filter(Favorite.user_id == current_user.id, Favorite.post_id == post_id).first()
    notification = None
    if payload.favorited and favorite is None:
        db.add(Favorite(user_id=current_user.id, post_id=post_id))
        post.favorite_count += 1
        if post.author_id != current_user.id:
            notification = create_notification(
                db,
                recipient_id=post.author_id,
                actor_id=current_user.id,
                type="post_favorited",
                post_id=post.id,
                post_title=post.title,
            )
    elif not payload.favorited and favorite is not None:
        db.delete(favorite)
        post.favorite_count = max(0, post.favorite_count - 1)
        delete_unread_notification(
            db,
            recipient_id=post.author_id,
            actor_id=current_user.id,
            type="post_favorited",
            post_id=post.id,
        )
    db.commit()
    db.refresh(post)
    if notification is not None:
        push_notification(notification, current_user)
    return FavoriteResponse(favorited=payload.favorited, favorite_count=post.favorite_count)


@router.post("/{post_id}/dislike")
def dislike_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    post = db.query(Post).filter(Post.id == post_id, Post.status == "published").first()
    if post is None:
        raise HTTPException(status_code=404, detail="博客不存在")
    dislike = db.query(PostDislike).filter(PostDislike.user_id == current_user.id, PostDislike.post_id == post_id).first()
    if dislike is None:
        db.add(PostDislike(user_id=current_user.id, post_id=post_id))
        db.commit()
    return {"disliked": True}
