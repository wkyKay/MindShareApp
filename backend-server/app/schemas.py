from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class ErrorResponse(BaseModel):
    detail: str
    code: str


class UserPublic(BaseModel):
    id: int
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None


class UserPrivate(UserPublic):
    email: EmailStr


class UserUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=64)
    bio: Optional[str] = None
    avatar_asset_id: Optional[int] = None


class CaptchaResponse(BaseModel):
    captcha_key: str
    image_url: str
    expires_in: int


class RegisterRequest(BaseModel):
    username: str = Field(max_length=32)
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(max_length=64)
    captcha_key: str
    captcha_code: str


class LoginRequest(BaseModel):
    account: str
    password: str
    captcha_key: str
    captcha_code: str


class TokenResponse(BaseModel):
    user: UserPrivate
    access_token: str
    token_type: str = "bearer"


class AssetResponse(BaseModel):
    id: int
    kind: str
    original_name: str
    mime_type: str
    file_size: int
    url: Optional[str] = None


class DocumentParseResponse(BaseModel):
    asset_id: int
    original_name: str
    parse_status: str
    extracted_text: Optional[str] = None


class AuthorSummary(BaseModel):
    id: int
    display_name: str
    avatar_url: Optional[str] = None


class PostCreate(BaseModel):
    title: str = Field(max_length=120)
    body: str
    summary: Optional[str] = Field(default=None, max_length=300)
    cover_asset_id: Optional[int] = None
    image_asset_ids: list[int] = Field(default_factory=list)
    document_asset_ids: list[int] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    visibility: str = "public"
    status: str = "published"


class PostUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)
    body: Optional[str] = None
    summary: Optional[str] = Field(default=None, max_length=300)
    cover_asset_id: Optional[int] = None
    image_asset_ids: Optional[list[int]] = None
    document_asset_ids: Optional[list[int]] = None
    tags: Optional[list[str]] = None
    visibility: Optional[str] = None
    status: Optional[str] = None


class PostCreated(BaseModel):
    id: int
    title: str
    status: str
    visibility: str
    created_at: datetime


class PostListItem(BaseModel):
    id: int
    title: str
    summary: Optional[str] = None
    cover_url: Optional[str] = None
    tags: list[str]
    status: str
    author: AuthorSummary
    like_count: int
    comment_count: int
    favorite_count: int
    is_liked: bool
    is_favorited: bool
    created_at: datetime


class PostDetail(PostListItem):
    body: str
    image_urls: list[str] = Field(default_factory=list)
    updated_at: datetime


class LikeRequest(BaseModel):
    liked: bool


class LikeResponse(BaseModel):
    liked: bool
    like_count: int


class FavoriteRequest(BaseModel):
    favorited: bool


class FavoriteResponse(BaseModel):
    favorited: bool
    favorite_count: int


class CommentCreate(BaseModel):
    body: str
    parent_id: Optional[int] = None


class CommentResponse(BaseModel):
    id: int
    body: str
    author: Optional[AuthorSummary] = None
    parent_id: Optional[int] = None
    created_at: datetime


class CollectionCreate(BaseModel):
    title: str = Field(max_length=120)
    description: Optional[str] = None
    cover_asset_id: Optional[int] = None
    visibility: str = "public"


class CollectionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = None
    cover_asset_id: Optional[int] = None
    visibility: Optional[str] = None


class CollectionCreated(BaseModel):
    id: int
    title: str
    visibility: str
    created_at: datetime


class CollectionItemRequest(BaseModel):
    post_id: int
    sort_order: int = 0


class CollectionItemUpdate(BaseModel):
    sort_order: int


class CollectionPostItem(BaseModel):
    post_id: int
    title: str
    sort_order: int


class CollectionDetail(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    owner: AuthorSummary
    items: list[CollectionPostItem]


class SearchResult(BaseModel):
    type: str
    id: int
    title: str
    summary: Optional[str] = None
    author_name: Optional[str] = None
    created_at: Optional[datetime] = None


class PageResponse(BaseModel):
    items: list
    page: int
    page_size: int
    total: int
