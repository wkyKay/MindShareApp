from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user, get_optional_current_user
from ..database import get_db
from ..models import Asset, Collection, CollectionFavorite, CollectionItem, Post, User
from ..schemas import (
    AuthorSummary,
    CollectionCreate,
    CollectionCreated,
    CollectionDetail,
    CollectionFavoriteRequest,
    CollectionFavoriteResponse,
    CollectionItemRequest,
    CollectionItemUpdate,
    CollectionUpdate,
    PageResponse,
)

router = APIRouter()


@router.post("", response_model=CollectionCreated, status_code=status.HTTP_201_CREATED)
def create_collection(
    payload: CollectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CollectionCreated:
    title = payload.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="合集名称不能为空")
    if payload.visibility not in {"public", "private"}:
        raise HTTPException(status_code=400, detail="合集可见性无效")
    collection = Collection(
        owner_id=current_user.id,
        title=title,
        description=payload.description.strip() if payload.description else None,
        cover_asset_id=payload.cover_asset_id,
        visibility=payload.visibility,
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return CollectionCreated(
        id=collection.id,
        title=collection.title,
        visibility=collection.visibility,
        created_at=collection.created_at,
    )


@router.get("", response_model=PageResponse)
def list_collections(
    owner_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> PageResponse:
    query = db.query(Collection).filter(Collection.status != "deleted")
    if owner_id is not None:
        query = query.filter(Collection.owner_id == owner_id)
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
                "is_favorited": _is_collection_favorited(db, collection.id, current_user),
            }
            for collection in collections
        ],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{collection_id}", response_model=CollectionDetail)
def get_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
) -> CollectionDetail:
    row = (
        db.query(Collection, User)
        .join(User, User.id == Collection.owner_id)
        .filter(Collection.id == collection_id, Collection.status != "deleted")
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="合集不存在")
    collection, owner = row
    if collection.visibility == "private" and (current_user is None or current_user.id != collection.owner_id):
        raise HTTPException(status_code=404, detail="合集不存在")
    cover_url = None
    if collection.cover_asset_id:
        cover_url = db.query(Asset.public_url).filter(Asset.id == collection.cover_asset_id).scalar()
    items = (
        db.query(CollectionItem, Post)
        .join(Post, Post.id == CollectionItem.post_id)
        .filter(CollectionItem.collection_id == collection_id, Post.status == "published")
        .order_by(CollectionItem.sort_order.asc(), CollectionItem.added_at.desc())
        .all()
    )
    return CollectionDetail(
        id=collection_id,
        title=collection.title,
        description=collection.description,
        cover_url=cover_url,
        owner=AuthorSummary(id=owner.id, display_name=owner.display_name, avatar_url=None),
        items=[
            {"post_id": post.id, "title": post.title, "sort_order": item.sort_order}
            for item, post in items
        ],
    )


@router.patch("/{collection_id}", response_model=CollectionCreated)
def update_collection(
    collection_id: int,
    payload: CollectionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CollectionCreated:
    collection = _get_owned_collection(db, collection_id, current_user.id)
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=400, detail="合集名称不能为空")
        collection.title = title
    if payload.description is not None:
        collection.description = payload.description.strip() or None
    if payload.cover_asset_id is not None:
        collection.cover_asset_id = payload.cover_asset_id
    if payload.visibility is not None:
        if payload.visibility not in {"public", "private"}:
            raise HTTPException(status_code=400, detail="合集可见性无效")
        collection.visibility = payload.visibility
    db.commit()
    db.refresh(collection)
    return CollectionCreated(
        id=collection_id,
        title=collection.title,
        visibility=collection.visibility,
        created_at=collection.created_at,
    )


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(
    collection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    collection = _get_owned_collection(db, collection_id, current_user.id)
    collection.status = "deleted"
    db.query(CollectionFavorite).filter(CollectionFavorite.collection_id == collection_id).delete()
    db.commit()
    return None


@router.post("/{collection_id}/items", status_code=status.HTTP_201_CREATED)
def add_collection_item(
    collection_id: int,
    payload: CollectionItemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    collection = _get_owned_collection(db, collection_id, current_user.id)
    post = db.query(Post).filter(Post.id == payload.post_id, Post.author_id == current_user.id, Post.status != "deleted").first()
    if post is None:
        raise HTTPException(status_code=404, detail="只能添加自己的有效文章")
    item = db.query(CollectionItem).filter(
        CollectionItem.collection_id == collection_id,
        CollectionItem.post_id == payload.post_id,
    ).first()
    if item is None:
        db.add(CollectionItem(collection_id=collection_id, post_id=payload.post_id, sort_order=payload.sort_order))
        collection.item_count += 1
    else:
        item.sort_order = payload.sort_order
    db.commit()
    return {"collection_id": collection_id, "post_id": payload.post_id, "sort_order": payload.sort_order}


@router.patch("/{collection_id}/items/{post_id}")
def update_collection_item(
    collection_id: int,
    post_id: int,
    payload: CollectionItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    _get_owned_collection(db, collection_id, current_user.id)
    item = db.query(CollectionItem).filter(
        CollectionItem.collection_id == collection_id,
        CollectionItem.post_id == post_id,
    ).first()
    if item is None:
        raise HTTPException(status_code=404, detail="合集内容不存在")
    item.sort_order = payload.sort_order
    db.commit()
    return {"collection_id": collection_id, "post_id": post_id, "sort_order": payload.sort_order}


@router.delete("/{collection_id}/items/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_collection_item(
    collection_id: int,
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    collection = _get_owned_collection(db, collection_id, current_user.id)
    item = db.query(CollectionItem).filter(
        CollectionItem.collection_id == collection_id,
        CollectionItem.post_id == post_id,
    ).first()
    if item is not None:
        db.delete(item)
        collection.item_count = max(0, collection.item_count - 1)
        db.commit()
    return None


@router.post("/{collection_id}/favorite", response_model=CollectionFavoriteResponse)
def toggle_collection_favorite(
    collection_id: int,
    payload: CollectionFavoriteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CollectionFavoriteResponse:
    collection = db.query(Collection).filter(Collection.id == collection_id, Collection.status != "deleted").first()
    if collection is None or (collection.visibility == "private" and collection.owner_id != current_user.id):
        raise HTTPException(status_code=404, detail="合集不存在")
    if collection.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能收藏自己的合集")
    favorite = db.query(CollectionFavorite).filter(
        CollectionFavorite.user_id == current_user.id,
        CollectionFavorite.collection_id == collection_id,
    ).first()
    if payload.favorited and favorite is None:
        db.add(CollectionFavorite(user_id=current_user.id, collection_id=collection_id))
    elif not payload.favorited and favorite is not None:
        db.delete(favorite)
    db.commit()
    return CollectionFavoriteResponse(favorited=payload.favorited)


def _get_owned_collection(db: Session, collection_id: int, owner_id: int) -> Collection:
    collection = db.query(Collection).filter(
        Collection.id == collection_id,
        Collection.owner_id == owner_id,
        Collection.status != "deleted",
    ).first()
    if collection is None:
        raise HTTPException(status_code=404, detail="合集不存在")
    return collection


def _is_collection_favorited(db: Session, collection_id: int, current_user: Optional[User]) -> bool:
    return current_user is not None and db.query(CollectionFavorite.id).filter(
        CollectionFavorite.user_id == current_user.id,
        CollectionFavorite.collection_id == collection_id,
    ).first() is not None
