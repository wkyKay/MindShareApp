from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..cache import get_tag_suggestions as _cache_get_tags
from ..cache import set_tag_suggestions as _cache_set_tags
from ..database import get_db
from ..models import Tag
from ..schemas import PageResponse

router = APIRouter()


HOT_TAGS_LIMIT = 30


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
    normalized = q.strip().lower()

    if not normalized:
        hot_tags = _load_hot_tags(db)
        return hot_tags[:limit]

    cache_key = normalized
    cached = _cache_get_tags(cache_key)
    if cached is not None:
        return cached[:limit]

    query = db.query(Tag.name)
    query = query.filter(func.lower(Tag.name).contains(normalized))
    rows = query.order_by(Tag.name.asc()).limit(limit).all()
    result = [row[0] for row in rows]
    _cache_set_tags(cache_key, result)
    return result


def _load_hot_tags(db: Session) -> list[str]:
    from sqlalchemy import text

    cached = _cache_get_tags("__hot__")
    if cached is not None:
        return cached

    rows = db.execute(
        text(
            "SELECT t.name FROM tags t "
            "JOIN post_tags pt ON pt.tag_id = t.id "
            "GROUP BY t.id "
            "ORDER BY COUNT(pt.post_id) DESC "
            "LIMIT :limit"
        ),
        {"limit": HOT_TAGS_LIMIT},
    ).fetchall()
    result = [row[0] for row in rows]
    _cache_set_tags("__hot__", result, ttl=600)
    return result
