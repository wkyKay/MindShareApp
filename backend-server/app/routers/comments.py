from datetime import datetime

from fastapi import APIRouter, Depends, status

from ..auth import get_current_user
from ..models import User
from ..schemas import CommentCreate, CommentResponse, PageResponse

router = APIRouter()


@router.get("/posts/{post_id}/comments", response_model=PageResponse)
def list_comments(post_id: int, page: int = 1, page_size: int = 20) -> PageResponse:
    return PageResponse(items=[], page=page, page_size=page_size, total=0)


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: int, payload: CommentCreate, current_user: User = Depends(get_current_user)
) -> CommentResponse:
    return CommentResponse(
        id=1,
        body=payload.body,
        author=None,
        parent_id=payload.parent_id,
        created_at=datetime.utcnow(),
    )


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, current_user: User = Depends(get_current_user)) -> None:
    return None
