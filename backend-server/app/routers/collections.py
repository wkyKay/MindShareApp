from datetime import datetime

from fastapi import APIRouter, Depends, status

from ..auth import get_current_user
from ..models import User
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
    owner_id: int | None = None, page: int = 1, page_size: int = 20
) -> PageResponse:
    return PageResponse(items=[], page=page, page_size=page_size, total=0)


@router.get("/{collection_id}", response_model=CollectionDetail)
def get_collection(collection_id: int) -> CollectionDetail:
    return CollectionDetail(
        id=collection_id,
        title="示例合集",
        description="连载归档",
        cover_url=None,
        owner=AuthorSummary(id=1, display_name="Alice", avatar_url=None),
        items=[],
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
