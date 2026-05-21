from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Asset, Collection, CollectionItem, Post, User
from ..schemas import (
    AuthorSummary,
    CollectionCreate,
    CollectionCreated,
    CollectionDetail,
    CollectionItemRequest,
    CollectionItemUpdate,
    CollectionUpdate,
    PageResponse,
)

router = APIRouter()


@router.post("", response_model=CollectionCreated, status_code=status.HTTP_201_CREATED)
def create_collection(
    payload: CollectionCreate, current_user: User = Depends(get_current_user)
) -> CollectionCreated:
    return CollectionCreated(
        id=1,
        title=payload.title,
        visibility=payload.visibility,
        created_at=datetime.utcnow(),
    )


@router.get("", response_model=PageResponse)
def list_collections(
    owner_id: Optional[int] = None, page: int = 1, page_size: int = 20, db: Session = Depends(get_db)
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
            }
            for collection in collections
        ],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{collection_id}", response_model=CollectionDetail)
def get_collection(collection_id: int, db: Session = Depends(get_db)) -> CollectionDetail:
    row = (
        db.query(Collection, User)
        .join(User, User.id == Collection.owner_id)
        .filter(Collection.id == collection_id, Collection.status != "deleted")
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="合集不存在")
    collection, owner = row
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
) -> CollectionCreated:
    return CollectionCreated(
        id=collection_id,
        title=payload.title or "示例合集",
        visibility=payload.visibility or "public",
        created_at=datetime.utcnow(),
    )


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_collection(collection_id: int, current_user: User = Depends(get_current_user)) -> None:
    return None


@router.post("/{collection_id}/items", status_code=status.HTTP_201_CREATED)
def add_collection_item(
    collection_id: int,
    payload: CollectionItemRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    return {"collection_id": collection_id, "post_id": payload.post_id, "sort_order": payload.sort_order}


@router.patch("/{collection_id}/items/{post_id}")
def update_collection_item(
    collection_id: int,
    post_id: int,
    payload: CollectionItemUpdate,
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    return {"collection_id": collection_id, "post_id": post_id, "sort_order": payload.sort_order}


@router.delete("/{collection_id}/items/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_collection_item(
    collection_id: int, post_id: int, current_user: User = Depends(get_current_user)
) -> None:
    return None
