from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import get_optional_current_user
from ..cache import get_tag_suggestions as _cache_get_tags
from ..cache import set_tag_suggestions as _cache_set_tags
from ..database import get_db
from ..models import Collection, Follow, Post, PostTag, Tag, User
from ..schemas import PageResponse, SearchResult

router = APIRouter()


HOT_TAGS_LIMIT = 30
SEARCH_TYPES = {
    "all",
    "post",
    "posts",
    "user",
    "users",
    "collection",
    "collections",
    "tag",
    "tags",
}
SEARCH_SORTS = {"relevance", "newest"}


def _contains(field, query: str):
    return func.lower(field).contains(query)


@router.get("", response_model=PageResponse)
def search(
    q: str = Query(..., min_length=1),
    type: str = "all",
    sort: str = "relevance",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> PageResponse:
    normalized_query = q.strip().lower()
    normalized_type = type.strip().lower()
    normalized_sort = sort.strip().lower()

    if not normalized_query:
        raise HTTPException(status_code=400, detail="搜索关键词不能为空")
    if normalized_type not in SEARCH_TYPES:
        raise HTTPException(status_code=400, detail="搜索类型无效")
    if normalized_sort not in SEARCH_SORTS:
        raise HTTPException(status_code=400, detail="排序方式无效")

    results: list[tuple[SearchResult, int]] = []
    if normalized_type in {"all", "post", "posts"}:
        results.extend(_search_posts(db, current_user, normalized_query))
    if normalized_type in {"all", "user", "users"}:
        results.extend(_search_users(db, normalized_query))
    if normalized_type in {"all", "collection", "collections"}:
        results.extend(_search_collections(db, current_user, normalized_query))
    if normalized_type in {"all", "tag", "tags"}:
        results.extend(_search_tags(db, normalized_query))

    if normalized_sort == "newest":
        results.sort(key=lambda item: item[0].created_at or datetime.min, reverse=True)
    else:
        results.sort(key=lambda item: (item[1], item[0].created_at or datetime.min), reverse=True)

    total = len(results)
    start = (page - 1) * page_size
    page_items = [item.model_dump() for item, _score in results[start : start + page_size]]
    return PageResponse(items=page_items, page=page, page_size=page_size, total=total)


def _search_posts(
    db: Session,
    current_user: Optional[User],
    query: str,
) -> list[tuple[SearchResult, int]]:
    post_query = (
        db.query(Post, User)
        .join(User, User.id == Post.author_id)
        .filter(Post.status == "published")
    )
    post_query = _filter_visible_posts(post_query, current_user, db)
    post_query = (
        post_query.outerjoin(PostTag, PostTag.post_id == Post.id)
        .outerjoin(Tag, Tag.id == PostTag.tag_id)
        .filter(
            _contains(Post.title, query)
            | _contains(Post.summary, query)
            | _contains(Post.body, query)
            | _contains(Tag.name, query)
        )
    )

    seen: set[int] = set()
    results: list[tuple[SearchResult, int]] = []
    for post, author in post_query.order_by(Post.created_at.desc()).all():
        if post.id in seen:
            continue
        seen.add(post.id)
        score = _score_text(query, post.title, post.summary, post.body)
        results.append(
            (
                SearchResult(
                    type="post",
                    id=post.id,
                    title=post.title,
                    summary=post.summary,
                    author_name=author.display_name,
                    created_at=post.created_at,
                ),
                score,
            )
        )
    return results


def _search_users(db: Session, query: str) -> list[tuple[SearchResult, int]]:
    rows = (
        db.query(User)
        .filter(
            User.status == "active",
            _contains(User.username, query) | _contains(User.display_name, query) | _contains(User.bio, query),
        )
        .order_by(User.created_at.desc())
        .all()
    )
    return [
        (
            SearchResult(
                type="user",
                id=user.id,
                title=user.display_name,
                summary=user.bio,
                author_name=user.username,
                created_at=user.created_at,
            ),
            _score_text(query, user.display_name, user.username, user.bio),
        )
        for user in rows
    ]


def _search_collections(
    db: Session,
    current_user: Optional[User],
    query: str,
) -> list[tuple[SearchResult, int]]:
    collection_query = (
        db.query(Collection, User)
        .join(User, User.id == Collection.owner_id)
        .filter(
            Collection.status != "deleted",
            _contains(Collection.title, query) | _contains(Collection.description, query),
        )
    )
    if current_user is None:
        collection_query = collection_query.filter(Collection.visibility == "public")
    else:
        collection_query = collection_query.filter(
            (Collection.visibility == "public")
            | (Collection.owner_id == current_user.id)
        )

    return [
        (
            SearchResult(
                type="collection",
                id=collection.id,
                title=collection.title,
                summary=collection.description,
                author_name=owner.display_name,
                created_at=collection.created_at,
            ),
            _score_text(query, collection.title, collection.description),
        )
        for collection, owner in collection_query.order_by(Collection.created_at.desc()).all()
    ]


def _search_tags(db: Session, query: str) -> list[tuple[SearchResult, int]]:
    rows = db.query(Tag).filter(_contains(Tag.name, query)).order_by(Tag.name.asc()).all()
    return [
        (
            SearchResult(
                type="tag",
                id=tag.id,
                title=tag.name,
                summary=None,
                author_name=None,
                created_at=tag.created_at,
            ),
            _score_text(query, tag.name),
        )
        for tag in rows
    ]


def _filter_visible_posts(query, current_user: Optional[User], db: Session):
    if current_user is None:
        return query.filter(Post.visibility == "public")
    following_ids = {
        row[0]
        for row in db.query(Follow.following_id)
        .filter(Follow.follower_id == current_user.id)
        .all()
    }
    return query.filter(
        (Post.visibility == "public")
        | ((Post.visibility == "followers") & Post.author_id.in_(following_ids | {current_user.id}))
        | ((Post.visibility == "private") & (Post.author_id == current_user.id))
    )


def _score_text(query: str, *values: Optional[str]) -> int:
    score = 0
    for index, value in enumerate(values):
        if not value:
            continue
        text = value.lower()
        if text == query:
            score += 100 - index * 10
        elif text.startswith(query):
            score += 60 - index * 8
        elif query in text:
            score += 30 - index * 4
    return score


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
