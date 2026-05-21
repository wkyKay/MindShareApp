from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ErrorResponse(BaseModel):
    detail: str
    code: str


class UserPublic(BaseModel):
    id: int
    username: str
    display_name: str
    avatar_url: str | None = None
    bio: str | None = None


class UserPrivate(UserPublic):
    email: EmailStr


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=64)
    bio: str | None = None
    avatar_asset_id: int | None = None


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
    url: str | None = None


class DocumentParseResponse(BaseModel):
    asset_id: int
    original_name: str
    parse_status: str
    extracted_text: str | None = None


class AuthorSummary(BaseModel):
    id: int
    display_name: str
    avatar_url: str | None = None


class PostCreate(BaseModel):
    title: str = Field(max_length=120)
    body: str
    summary: str | None = Field(default=None, max_length=300)
    cover_asset_id: int | None = None
    image_asset_ids: list[int] = Field(default_factory=list)
    document_asset_ids: list[int] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    visibility: str = "public"
    status: str = "published"


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    body: str | None = None
    summary: str | None = Field(default=None, max_length=300)
    cover_asset_id: int | None = None
    image_asset_ids: list[int] | None = None
    document_asset_ids: list[int] | None = None
    tags: list[str] | None = None
    visibility: str | None = None
    status: str | None = None


class PostCreated(BaseModel):
    id: int
    title: str
    status: str
    visibility: str
    created_at: datetime


class PostListItem(BaseModel):
    id: int
    title: str
    summary: str | None = None
    cover_url: str | None = None
    tags: list[str]
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
    parent_id: int | None = None


class CommentResponse(BaseModel):
    id: int
    body: str
    author: AuthorSummary | None = None
    parent_id: int | None = None
    created_at: datetime


class CollectionCreate(BaseModel):
    title: str = Field(max_length=120)
    description: str | None = None
    cover_asset_id: int | None = None
    visibility: str = "public"


class CollectionUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    description: str | None = None
    cover_asset_id: int | None = None
    visibility: str | None = None


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
    description: str | None = None
    cover_url: str | None = None
    owner: AuthorSummary
    items: list[CollectionPostItem]


class SearchResult(BaseModel):
    type: str
    id: int
    title: str
    summary: str | None = None
    author_name: str | None = None
    created_at: datetime | None = None


class PageResponse(BaseModel):
    items: list
    page: int
    page_size: int
    total: int
