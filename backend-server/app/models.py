from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        comment="创建时间",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        comment="更新时间",
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = {"comment": "用户账号与个人主页信息"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, comment="用户 ID")
    username: Mapped[str] = mapped_column(
        String(32), unique=True, nullable=False, index=True, comment="用户名，登录和个人主页使用"
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True, comment="邮箱，登录和通知使用"
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False, comment="密码哈希，不保存明文")
    display_name: Mapped[str] = mapped_column(String(64), nullable=False, comment="展示昵称")
    avatar_asset_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="头像资源 ID，对应 assets.id")
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="个人简介")
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False, index=True, comment="账号状态：active、disabled、deleted"
    )


class Captcha(Base):
    __tablename__ = "captchas"
    __table_args__ = {"comment": "登录和注册验证码"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="验证码 ID")
    captcha_key: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True, comment="返回给前端的验证码标识"
    )
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False, comment="验证码哈希，不保存明文")
    purpose: Mapped[str] = mapped_column(String(20), nullable=False, index=True, comment="验证码用途：register、login")
    target: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment="邮箱、用户名或客户端标识")
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="过期时间")
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="使用时间")
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False, comment="错误次数")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")


class Post(TimestampMixin, Base):
    __tablename__ = "posts"
    __table_args__ = {"comment": "博客或文章主体"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, comment="博客 ID")
    author_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="作者用户 ID，对应 users.id")
    title: Mapped[str] = mapped_column(String(120), nullable=False, index=True, comment="标题")
    body: Mapped[str] = mapped_column(Text, nullable=False, comment="正文，第一版存 Markdown 文本")
    summary: Mapped[Optional[str]] = mapped_column(String(300), nullable=True, comment="摘要，用于列表和搜索结果")
    cover_asset_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="封面资源 ID，对应 assets.id")
    visibility: Mapped[str] = mapped_column(
        String(20), default="public", nullable=False, index=True, comment="可见性：public、followers、private"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="published", nullable=False, index=True, comment="文章状态：draft、published、archived、deleted"
    )
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, comment="点赞数缓存")
    comment_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, comment="评论数缓存")
    favorite_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, comment="收藏数缓存")
    view_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, comment="浏览数缓存")
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, comment="发布时间")


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = {"comment": "标签字典"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="标签 ID")
    name: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True, comment="标签名")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="创建时间")


class PostTag(Base):
    __tablename__ = "post_tags"
    __table_args__ = {"comment": "博客和标签多对多关系"}

    post_id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="博客 ID，对应 posts.id")
    tag_id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="标签 ID，对应 tags.id")


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = {"comment": "上传图片、封面图、头像、原始文档等文件元信息"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="资源 ID")
    uploader_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="上传用户 ID，对应 users.id")
    post_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True, comment="关联博客 ID，对应 posts.id，可后绑定")
    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True, comment="资源类型：image、document、avatar、cover")
    original_name: Mapped[str] = mapped_column(String(255), nullable=False, comment="原始文件名")
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False, comment="MIME 类型")
    file_ext: Mapped[str] = mapped_column(String(16), nullable=False, comment="扩展名")
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, comment="文件大小，单位 bytes")
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False, comment="本地存储路径")
    public_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, comment="前端可访问地址")
    parse_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, comment="文档解析状态：pending、success、failed")
    parse_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="文档解析错误")
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="文档解析出的文本")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="上传时间")


class Collection(TimestampMixin, Base):
    __tablename__ = "collections"
    __table_args__ = {"comment": "合集信息"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="合集 ID")
    owner_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="创建者用户 ID，对应 users.id")
    title: Mapped[str] = mapped_column(String(120), nullable=False, comment="合集标题")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="合集简介")
    cover_asset_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="合集封面资源 ID，对应 assets.id")
    visibility: Mapped[str] = mapped_column(
        String(20), default="public", nullable=False, index=True, comment="可见性：public、private"
    )
    status: Mapped[str] = mapped_column(
        String(20), default="active", nullable=False, index=True, comment="合集状态：active、deleted"
    )
    item_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, comment="内容数量缓存")


class CollectionItem(Base):
    __tablename__ = "collection_items"
    __table_args__ = {"comment": "合集和博客关联关系"}

    collection_id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="合集 ID，对应 collections.id")
    post_id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="博客 ID，对应 posts.id")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False, comment="合集内排序")
    added_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="加入时间")


class CollectionFavorite(Base):
    __tablename__ = "collection_favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "collection_id", name="uq_collection_favorites_user_collection"),
        {"comment": "合集收藏关系"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="合集收藏 ID")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="用户 ID，对应 users.id")
    collection_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="合集 ID，对应 collections.id")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="收藏时间")


class Like(Base):
    __tablename__ = "likes"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_likes_user_post"),
        {"comment": "点赞关系"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="点赞 ID")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="用户 ID，对应 users.id")
    post_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="博客 ID，对应 posts.id")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="点赞时间")


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_favorites_user_post"),
        {"comment": "收藏关系"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="收藏 ID")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="用户 ID，对应 users.id")
    post_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="博客 ID，对应 posts.id")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="收藏时间")


class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="uq_follows_follower_following"),
        {"comment": "用户关注关系"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="关注 ID")
    follower_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="关注者用户 ID")
    following_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="被关注用户 ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="关注时间")


class Comment(TimestampMixin, Base):
    __tablename__ = "comments"
    __table_args__ = {"comment": "博客评论和回复"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="评论 ID")
    post_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="所属博客 ID，对应 posts.id")
    author_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="评论作者用户 ID，对应 users.id")
    parent_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True, comment="父评论 ID，对应 comments.id，用于回复")
    body: Mapped[str] = mapped_column(Text, nullable=False, comment="评论正文")
    status: Mapped[str] = mapped_column(
        String(20), default="published", nullable=False, index=True, comment="评论状态：published、deleted、hidden"
    )
    like_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, comment="评论点赞数缓存")


class CommentLike(Base):
    __tablename__ = "comment_likes"
    __table_args__ = (
        UniqueConstraint("user_id", "comment_id", name="uq_comment_likes_user_comment"),
        {"comment": "评论点赞关系"},
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="评论点赞 ID")
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="用户 ID，对应 users.id")
    comment_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="评论 ID，对应 comments.id")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), comment="点赞时间")


class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = {"comment": "用户通知，当前用于评论和回复提醒"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, comment="通知 ID")
    recipient_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="接收通知的用户 ID")
    actor_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="触发通知的用户 ID")
    post_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="关联博客 ID")
    comment_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True, comment="关联评论 ID")
    parent_comment_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True, comment="被回复评论 ID")
    type: Mapped[str] = mapped_column(String(30), nullable=False, index=True, comment="通知类型：comment_created、comment_reply")
    is_read: Mapped[bool] = mapped_column(default=False, nullable=False, index=True, comment="是否已读")
