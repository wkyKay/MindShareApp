from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Tag
from ..schemas import PageResponse

router = APIRouter()


@router.get("", response_model=PageResponse)
def search(
    q: str,
    type: str = "all",
    sort: str = "relevance",
    page: int = 1,
    page_size: int = 20,
) -> PageResponse:
    return PageResponse(items=[], page=page, page_size=page_size, total=0)


@router.get("/tags", response_model=list[str])
def search_tags(q: str = "", limit: int = 10, db: Session = Depends(get_db)) -> list[str]:
    query = db.query(Tag.name)
    normalized = q.strip().lower()
    if normalized:
        query = query.filter(func.lower(Tag.name).contains(normalized))
    rows = query.order_by(Tag.name.asc()).limit(limit).all()
    return [row[0] for row in rows]
