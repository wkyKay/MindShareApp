from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Asset, Post, PostTag, Tag, User
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


def _post_detail(post: Post, author: User, db: Session) -> PostDetail:
    tags = (
        db.query(Tag.name)
        .join(PostTag, PostTag.tag_id == Tag.id)
        .filter(PostTag.post_id == post.id)
        .all()
    )
    cover_url = None
    if post.cover_asset_id:
        cover_url = db.query(Asset.public_url).filter(Asset.id == post.cover_asset_id).scalar()
    image_urls = [
        row[0]
        for row in db.query(Asset.public_url)
        .filter(Asset.post_id == post.id, Asset.kind == "image", Asset.public_url.isnot(None))
        .all()
    ]

    return PostDetail(
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
        is_favorited=False,
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
    author_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
) -> PageResponse:
    return PageResponse(items=[], page=page, page_size=page_size, total=0)


@router.get("/{post_id}", response_model=PostDetail)
def get_post(post_id: int, db: Session = Depends(get_db)) -> PostDetail:
    row = db.query(Post, User).join(User, User.id == Post.author_id).filter(Post.id == post_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="博客不存在")
    post, author = row
    return _post_detail(post, author, db)


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
