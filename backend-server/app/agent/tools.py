"""Agent 只读工具集：检索站内博客、查看全文、查看收藏。

所有工具均无副作用，权限随 current_user 注入，按请求隔离。
工具结果由 tool_executor 统一 JSON 序列化并截断。
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from langchain_core.tools import tool
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models import Favorite, Follow, Post, User
from ..rag.retriever import retrieve as _rag_retrieve

# 单次工具结果序列化后的最大字符数
TOOL_RESULT_MAX_CHARS = 8000
# get_post 正文最大字符数
GET_POST_BODY_MAX_CHARS = 8000
# 单次工具执行超时（秒）
TOOL_TIMEOUT_SECONDS = 10.0

# 软删除收藏脱敏占位标题
_DELETED_TITLE = "[内容已删除]"


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _visible_published_post_ids(user: User, db: Session) -> set:
    """返回当前用户可见的、已发布文章的 post_id 集合。

    可见规则与 retriever._visible_chunks 对齐：
    - public 所有人可见
    - followers 仅已关注作者可见
    - private 仅作者本人可见
    - status 仅 published
    """
    following_ids = {
        row[0]
        for row in db.query(Follow.following_id)
        .filter(Follow.follower_id == user.id)
        .all()
    }
    rows = (
        db.query(Post.id)
        .filter(
            Post.status == "published",
            (Post.visibility == "public")
            | ((Post.visibility == "followers") & Post.author_id.in_(following_ids | {user.id}))
            | ((Post.visibility == "private") & (Post.author_id == user.id)),
        )
        .all()
    )
    return {row[0] for row in rows}


def _can_view_post(user: User, db: Session, post: Post) -> bool:
    """单篇文章可见性校验，供 get_post 使用。"""
    if post.author_id == user.id:
        return True
    if post.visibility == "public":
        return True
    if post.visibility == "private":
        return False
    if post.visibility == "followers":
        return (
            db.query(Follow.id)
            .filter(Follow.follower_id == user.id, Follow.following_id == post.author_id)
            .first()
            is not None
        )
    return False


def build_tools(current_user: User, db: Session) -> list:
    """按请求构建只读工具，注入当前用户与数据库会话。"""

    @tool
    def search_posts(
        keyword: str,
        author: Optional[str] = None,
        only_mine: bool = False,
        limit: int = 5,
    ) -> Any:
        """按关键词检索站内已发布博客，返回标题、摘要、作者与发布时间。

        参数：
        - keyword: 必填，用于匹配标题/摘要/正文的关键词（至少 1 个字符）
        - author: 可选，用户名，仅在指定作者的知识库内检索
        - only_mine: 可选，为 True 时仅在"我发布的"文章内检索（含已归档）
        - limit: 返回条数，取值 1-10

        使用场景：用户想按关键词找文章、或限定某位作者 / 自己的文章时调用。
        """
        keyword = (keyword or "").strip()
        if not keyword:
            return "错误：keyword 不能为空。"
        limit = max(1, min(10, limit))

        if only_mine:
            scope_ids = {
                row[0]
                for row in db.query(Post.id)
                .filter(
                    Post.author_id == current_user.id,
                    Post.status.in_(["published", "archived"]),
                )
                .all()
            }
        elif author:
            target = db.query(User).filter(User.username == author).first()
            if target is None:
                return "未找到该用户，请确认用户名后重试。"
            author_ids = {
                row[0]
                for row in db.query(Post.id)
                .filter(Post.author_id == target.id, Post.status == "published")
                .all()
            }
            scope_ids = author_ids & _visible_published_post_ids(current_user, db)
        else:
            scope_ids = _visible_published_post_ids(current_user, db)

        if not scope_ids:
            return []

        kw = f"%{keyword}%"
        rows = (
            db.query(Post, User)
            .join(User, User.id == Post.author_id)
            .filter(
                Post.id.in_(scope_ids),
                or_(
                    Post.title.like(kw),
                    Post.summary.like(kw),
                    Post.body.like(kw),
                ),
            )
            .order_by(Post.published_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "post_id": post.id,
                "title": post.title,
                "summary": post.summary,
                "author": author_row.username,
                "published_at": _iso(post.published_at),
            }
            for post, author_row in rows
        ]

    @tool
    def rag_retrieve(
        query: str,
        top_k: int = 5,
        author: Optional[str] = None,
        only_mine: bool = False,
        only_favorites: bool = False,
        days: Optional[int] = None,
    ) -> Any:
        """语义检索站内博客正文，返回与问题最相关的片段。

        参数：
        - query: 必填，自然语言检索问题
        - top_k: 返回片段数，取值 1-10
        - author: 可选，用户名，仅检索该作者
        - only_mine: 可选，为 True 时仅检索"我发布的"文章
        - only_favorites: 可选，为 True 时仅检索"我收藏的"文章
        - days: 可选，按时间过滤（only_favorites 按收藏时间，其余按发布时间）

        使用场景：用户提出语义检索类问题（如"有没有关于 xxx 的文章"）时调用。
        """
        query = (query or "").strip()
        if not query:
            return "错误：query 不能为空。"
        top_k = max(1, min(10, top_k))

        since: Optional[datetime] = None
        if days is not None and days > 0:
            since = datetime.utcnow() - timedelta(days=days)

        include_archived_own = False
        if only_favorites:
            fav_q = db.query(Favorite.post_id).filter(Favorite.user_id == current_user.id)
            if since is not None:
                fav_q = fav_q.filter(Favorite.created_at >= since)
            post_ids: Optional[set] = {row[0] for row in fav_q.all()}
        elif only_mine:
            mine_q = db.query(Post.id).filter(
                Post.author_id == current_user.id,
                Post.status.in_(["published", "archived"]),
            )
            if since is not None:
                mine_q = mine_q.filter(Post.published_at >= since)
            post_ids = {row[0] for row in mine_q.all()}
            include_archived_own = True
        elif author:
            target = db.query(User).filter(User.username == author).first()
            if target is None:
                return "未找到该用户，请确认用户名后重试。"
            author_q = db.query(Post.id).filter(
                Post.author_id == target.id, Post.status == "published"
            )
            if since is not None:
                author_q = author_q.filter(Post.published_at >= since)
            author_ids = {row[0] for row in author_q.all()}
            post_ids = author_ids & _visible_published_post_ids(current_user, db)
        else:
            if since is not None:
                visible_ids = _visible_published_post_ids(current_user, db)
                post_ids = {
                    row[0]
                    for row in db.query(Post.id)
                    .filter(Post.status == "published", Post.published_at >= since)
                    .all()
                } & visible_ids
            else:
                post_ids = None

        try:
            chunks = _rag_retrieve(
                query,
                current_user,
                db,
                top_k=top_k,
                post_ids=post_ids,
                include_archived_own=include_archived_own,
            )
        except Exception as exc:
            return f"检索失败：{exc}"

        return [
            {
                "post_id": chunk.chunk.post_id,
                "post_title": chunk.post_title,
                "content": chunk.chunk.content,
            }
            for chunk in chunks
        ]

    @tool
    def get_post(post_id: int) -> Any:
        """按 post_id 查看单篇博客的完整内容。

        参数：
        - post_id: 博客 ID

        使用场景：需要读取某篇文章完整内容（如对比、深入讲解）时调用。
        """
        post = db.query(Post).filter(Post.id == post_id).first()
        if post is None or post.status == "deleted":
            return "该博客不存在或已删除。"
        if not _can_view_post(current_user, db, post):
            return "无权查看该博客。"

        author_row = db.query(User).filter(User.id == post.author_id).first()
        return {
            "post_id": post.id,
            "title": post.title,
            "summary": post.summary,
            "body": post.body[:GET_POST_BODY_MAX_CHARS],
            "author": author_row.username if author_row else "",
            "published_at": _iso(post.published_at),
        }

    @tool
    def list_collections(
        keyword: Optional[str] = None,
        days: Optional[int] = None,
        limit: int = 20,
    ) -> Any:
        """查看当前用户收藏的文章列表，支持关键词与时间过滤。

        参数：
        - keyword: 可选，按标题/摘要匹配
        - days: 可选，仅返回最近 N 天内收藏的文章
        - limit: 返回条数，取值 1-50

        使用场景：用户提到"我收藏的"文章、或"最近收藏了 xxx"时调用。
        """
        limit = max(1, min(50, limit))
        q = (
            db.query(Favorite, Post)
            .join(Post, Post.id == Favorite.post_id)
            .filter(Favorite.user_id == current_user.id)
        )
        if days is not None and days > 0:
            since = datetime.utcnow() - timedelta(days=days)
            q = q.filter(Favorite.created_at >= since)
        rows = q.order_by(Favorite.created_at.desc()).all()

        kw = (keyword or "").strip().lower()
        items: List[Dict[str, Any]] = []
        for fav, post in rows:
            if post.status == "deleted":
                # 软删除脱敏：不参与关键词匹配，仅展示占位
                if not kw:
                    items.append(
                        {
                            "post_id": post.id,
                            "title": _DELETED_TITLE,
                            "summary": None,
                            "favorited_at": _iso(fav.created_at),
                        }
                    )
                continue

            if kw:
                hay = f"{post.title or ''} {post.summary or ''}".lower()
                if kw not in hay:
                    continue

            items.append(
                {
                    "post_id": post.id,
                    "title": post.title,
                    "summary": post.summary,
                    "favorited_at": _iso(fav.created_at),
                }
            )
            if len(items) >= limit:
                break

        return items

    return [search_posts, rag_retrieve, get_post, list_collections]
