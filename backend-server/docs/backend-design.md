# 同人论坛后端数据库与 API 设计

## 目标范围

当前只完成后端设计，不实现后端代码。设计基于 `FastAPI + SQLite + SQLAlchemy + JWT + 本地 uploads/`，覆盖当前同人论坛原型需要的用户信息、博客信息、上传解析、合集、点赞、收藏、评论、搜索能力。

## 设计原则

- 第一版使用 SQLite，字段类型保持简单，便于后续迁移到 PostgreSQL。
- 所有需要登录的写操作通过 JWT 鉴权。
- 验证码、文件类型、文件大小、文档解析必须在服务端校验。
- 删除用户内容默认软删除或状态变更，避免误删关联数据。
- 点赞、收藏等关系表用唯一约束防止重复关系。

## 数据库表设计

### users

用户账号与个人主页信息。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | integer | PK | 用户 ID |
| username | varchar(32) | unique, not null | 用户名 |
| email | varchar(255) | unique, not null | 邮箱 |
| password_hash | varchar(255) | not null | 密码哈希 |
| display_name | varchar(64) | not null | 展示昵称 |
| avatar_asset_id | integer | FK assets.id, nullable | 头像资源 |
| bio | text | nullable | 个人简介 |
| status | varchar(20) | not null, default `active` | `active`、`disabled`、`deleted` |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |

索引：

- `uq_users_username` unique(`username`)
- `uq_users_email` unique(`email`)
- `ix_users_status_created_at` (`status`, `created_at`)

### captchas

登录和注册验证码。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | integer | PK | 验证码 ID |
| captcha_key | varchar(64) | unique, not null | 返回给前端的验证码标识 |
| code_hash | varchar(255) | not null | 验证码哈希，不保存明文 |
| purpose | varchar(20) | not null | `register`、`login` |
| target | varchar(255) | nullable | 邮箱、用户名或客户端标识 |
| expires_at | datetime | not null | 过期时间 |
| used_at | datetime | nullable | 使用时间 |
| failed_attempts | integer | not null, default 0 | 错误次数 |
| created_at | datetime | not null | 创建时间 |

索引：

- `uq_captchas_key` unique(`captcha_key`)
- `ix_captchas_purpose_expires_at` (`purpose`, `expires_at`)

### posts

博客或文章主体。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | integer | PK | 博客 ID |
| author_id | integer | FK users.id, not null | 作者 |
| title | varchar(120) | not null | 标题 |
| body | text | not null | 正文，第一版可存 Markdown 文本 |
| summary | varchar(300) | nullable | 摘要，用于列表和搜索结果 |
| cover_asset_id | integer | FK assets.id, nullable | 封面图 |
| visibility | varchar(20) | not null, default `public` | `public`、`followers`、`private` |
| status | varchar(20) | not null, default `published` | `draft`、`published`、`archived`、`deleted` |
| like_count | integer | not null, default 0 | 点赞数缓存 |
| comment_count | integer | not null, default 0 | 评论数缓存 |
| favorite_count | integer | not null, default 0 | 收藏数缓存 |
| view_count | integer | not null, default 0 | 浏览数缓存 |
| published_at | datetime | nullable | 发布时间 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |

索引：

- `ix_posts_author_status_created_at` (`author_id`, `status`, `created_at`)
- `ix_posts_status_visibility_created_at` (`status`, `visibility`, `created_at`)
- `ix_posts_title` (`title`)

### tags

标签字典。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | integer | PK | 标签 ID |
| name | varchar(32) | unique, not null | 标签名 |
| created_at | datetime | not null | 创建时间 |

索引：

- `uq_tags_name` unique(`name`)

### post_tags

博客和标签多对多关系。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| post_id | integer | PK, FK posts.id | 博客 ID |
| tag_id | integer | PK, FK tags.id | 标签 ID |

约束：

- primary key(`post_id`, `tag_id`)

### assets

上传图片、封面图、头像、原始文档等文件元信息。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | integer | PK | 资源 ID |
| uploader_id | integer | FK users.id, not null | 上传用户 |
| post_id | integer | FK posts.id, nullable | 关联博客，可后绑定 |
| kind | varchar(20) | not null | `image`、`document`、`avatar`、`cover` |
| original_name | varchar(255) | not null | 原始文件名 |
| mime_type | varchar(100) | not null | MIME 类型 |
| file_ext | varchar(16) | not null | 扩展名 |
| file_size | integer | not null | 文件大小，单位 bytes |
| storage_path | varchar(500) | not null | 本地存储路径 |
| public_url | varchar(500) | nullable | 前端可访问地址 |
| parse_status | varchar(20) | nullable | `pending`、`success`、`failed` |
| parse_error | text | nullable | 文档解析错误 |
| extracted_text | text | nullable | 文档解析出的文本 |
| created_at | datetime | not null | 上传时间 |

索引：

- `ix_assets_uploader_kind_created_at` (`uploader_id`, `kind`, `created_at`)
- `ix_assets_post_id` (`post_id`)

### collections

合集信息。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | integer | PK | 合集 ID |
| owner_id | integer | FK users.id, not null | 创建者 |
| title | varchar(120) | not null | 合集标题 |
| description | text | nullable | 合集简介 |
| cover_asset_id | integer | FK assets.id, nullable | 合集封面 |
| visibility | varchar(20) | not null, default `public` | `public`、`private` |
| status | varchar(20) | not null, default `active` | `active`、`deleted` |
| item_count | integer | not null, default 0 | 内容数量缓存 |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |

索引：

- `ix_collections_owner_status_created_at` (`owner_id`, `status`, `created_at`)
- `ix_collections_visibility_created_at` (`visibility`, `created_at`)

### collection_items

合集和博客关联关系。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| collection_id | integer | PK, FK collections.id | 合集 ID |
| post_id | integer | PK, FK posts.id | 博客 ID |
| sort_order | integer | not null, default 0 | 合集内排序 |
| added_at | datetime | not null | 加入时间 |

约束：

- primary key(`collection_id`, `post_id`)
- index(`collection_id`, `sort_order`)

### likes

点赞关系。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | integer | PK | 点赞 ID |
| user_id | integer | FK users.id, not null | 用户 |
| post_id | integer | FK posts.id, not null | 博客 |
| created_at | datetime | not null | 点赞时间 |

约束：

- unique(`user_id`, `post_id`)
- index(`post_id`, `created_at`)

### favorites

收藏关系。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | integer | PK | 收藏 ID |
| user_id | integer | FK users.id, not null | 用户 |
| post_id | integer | FK posts.id, not null | 博客 |
| created_at | datetime | not null | 收藏时间 |

约束：

- unique(`user_id`, `post_id`)
- index(`post_id`, `created_at`)

### comments

博客评论和回复。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | integer | PK | 评论 ID |
| post_id | integer | FK posts.id, not null | 所属博客 |
| author_id | integer | FK users.id, not null | 评论作者 |
| parent_id | integer | FK comments.id, nullable | 父评论，用于回复 |
| body | text | not null | 评论正文 |
| status | varchar(20) | not null, default `published` | `published`、`deleted`、`hidden` |
| created_at | datetime | not null | 创建时间 |
| updated_at | datetime | not null | 更新时间 |

索引：

- `ix_comments_post_status_created_at` (`post_id`, `status`, `created_at`)
- `ix_comments_author_created_at` (`author_id`, `created_at`)
- `ix_comments_parent_id` (`parent_id`)

## 核心关系

- 一个 `user` 可以创建多篇 `posts`。
- 一个 `post` 可以有多个 `assets`、多个 `tags`、多个 `comments`。
- 一个 `post` 可以属于多个 `collections`。
- 一个 `collection` 可以包含多个 `posts`。
- 一个 `user` 对同一篇 `post` 最多只能有一个 `like` 和一个 `favorite`。
- `comments.parent_id` 支持二级或多级回复，第一版接口可以只展示两级。

## API 设计约定

### 通用约定

- Base URL: `/api/v1`
- 时间字段使用 ISO 8601 字符串。
- 鉴权头：`Authorization: Bearer <access_token>`。
- 分页参数：`page` 从 1 开始，`page_size` 默认 20，最大 50。
- 列表响应统一返回 `items`、`page`、`page_size`、`total`。
- 错误响应统一返回：

```json
{
  "detail": "错误说明",
  "code": "ERROR_CODE"
}
```

### Auth API

#### GET /api/v1/auth/captcha

获取验证码。

Query:

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| purpose | string | 是 | `register` 或 `login` |

Response:

```json
{
  "captcha_key": "cap_abc123",
  "image_url": "/api/v1/auth/captcha/cap_abc123/image",
  "expires_in": 300
}
```

#### POST /api/v1/auth/register

注册用户。

Request:

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "password123",
  "display_name": "Alice",
  "captcha_key": "cap_abc123",
  "captcha_code": "8K3P"
}
```

Response:

```json
{
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "display_name": "Alice",
    "avatar_url": null,
    "bio": null
  },
  "access_token": "jwt-token",
  "token_type": "bearer"
}
```

#### POST /api/v1/auth/login

登录。

Request:

```json
{
  "account": "alice@example.com",
  "password": "password123",
  "captcha_key": "cap_abc123",
  "captcha_code": "8K3P"
}
```

Response:

```json
{
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "display_name": "Alice",
    "avatar_url": null,
    "bio": null
  },
  "access_token": "jwt-token",
  "token_type": "bearer"
}
```

#### GET /api/v1/auth/me

获取当前登录用户。

Auth: required

Response:

```json
{
  "id": 1,
  "username": "alice",
  "email": "alice@example.com",
  "display_name": "Alice",
  "avatar_url": null,
  "bio": "同人创作者"
}
```

### Users API

#### GET /api/v1/users/{user_id}

获取用户公开资料。

Response:

```json
{
  "id": 1,
  "username": "alice",
  "display_name": "Alice",
  "avatar_url": null,
  "bio": "同人创作者",
  "post_count": 12,
  "collection_count": 3
}
```

#### PATCH /api/v1/users/me

更新当前用户资料。

Auth: required

Request:

```json
{
  "display_name": "Alice New",
  "bio": "新的简介",
  "avatar_asset_id": 10
}
```

#### GET /api/v1/users/me/posts

获取当前用户发布的博客和草稿。

Auth: required

Query:

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| status | string | 否 | `draft`、`published`，不传则返回全部非删除内容 |
| page | integer | 否 | 页码 |
| page_size | integer | 否 | 每页数量 |

#### GET /api/v1/users/me/collections

获取当前用户创建的合集。

Auth: required

Query:

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | 否 | 页码 |
| page_size | integer | 否 | 每页数量 |

### Uploads API

#### POST /api/v1/uploads/images

上传图片，可用于正文图片、封面或头像。

Auth: required

Content-Type: `multipart/form-data`

Form:

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| file | file | 是 | jpg、png、webp、gif |
| kind | string | 是 | `image`、`cover`、`avatar` |

Response:

```json
{
  "id": 10,
  "kind": "image",
  "original_name": "cover.png",
  "mime_type": "image/png",
  "file_size": 204800,
  "url": "/uploads/2026/05/cover.png"
}
```

#### POST /api/v1/uploads/parse-document

上传文档并解析文字。前端把 `extracted_text` 填入或追加到博客正文。

Auth: required

Content-Type: `multipart/form-data`

Form:

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| file | file | 是 | `.docx`、`.pdf`、`.md`，`.doc` 第一版可返回不支持提示 |

Response:

```json
{
  "asset_id": 11,
  "original_name": "chapter-1.docx",
  "parse_status": "success",
  "extracted_text": "解析出的正文内容"
}
```

### Posts API

#### POST /api/v1/posts

创建博客或草稿。

Auth: required

Request:

```json
{
  "title": "第一章 雨夜",
  "body": "正文内容",
  "summary": "正文摘要",
  "cover_asset_id": 10,
  "image_asset_ids": [12, 13],
  "document_asset_ids": [11],
  "tags": ["原神", "同人文"],
  "visibility": "public",
  "status": "published"
}
```

Response:

```json
{
  "id": 100,
  "title": "第一章 雨夜",
  "status": "published",
  "visibility": "public",
  "created_at": "2026-05-20T10:00:00Z"
}
```

#### GET /api/v1/posts

获取博客列表，用于首页发现、关注页可后续扩展。

Query:

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tab | string | 否 | `discover`、`following`，默认 `discover` |
| tag | string | 否 | 标签过滤 |
| author_id | integer | 否 | 作者过滤 |
| page | integer | 否 | 页码 |
| page_size | integer | 否 | 每页数量 |

Response:

```json
{
  "items": [
    {
      "id": 100,
      "title": "第一章 雨夜",
      "summary": "正文摘要",
      "cover_url": "/uploads/2026/05/cover.png",
      "tags": ["原神", "同人文"],
      "author": {
        "id": 1,
        "display_name": "Alice",
        "avatar_url": null
      },
      "like_count": 8,
      "comment_count": 2,
      "favorite_count": 5,
      "is_liked": false,
      "is_favorited": false,
      "created_at": "2026-05-20T10:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

#### GET /api/v1/posts/{post_id}

获取博客详情。

Response:

```json
{
  "id": 100,
  "title": "第一章 雨夜",
  "body": "正文内容",
  "cover_url": "/uploads/2026/05/cover.png",
  "image_urls": ["/uploads/2026/05/p1.png"],
  "tags": ["原神", "同人文"],
  "author": {
    "id": 1,
    "display_name": "Alice",
    "avatar_url": null
  },
  "like_count": 8,
  "comment_count": 2,
  "favorite_count": 5,
  "is_liked": false,
  "is_favorited": false,
  "created_at": "2026-05-20T10:00:00Z",
  "updated_at": "2026-05-20T10:00:00Z"
}
```

#### PATCH /api/v1/posts/{post_id}

编辑博客。

Auth: required，且必须是作者。

Request 字段同创建博客，均可选。

#### DELETE /api/v1/posts/{post_id}

删除博客。

Auth: required，且必须是作者。

行为：将 `posts.status` 更新为 `deleted`。

#### POST /api/v1/posts/{post_id}/like

点赞或取消点赞。

Auth: required

Request:

```json
{
  "liked": true
}
```

Response:

```json
{
  "liked": true,
  "like_count": 9
}
```

#### POST /api/v1/posts/{post_id}/favorite

收藏或取消收藏。

Auth: required

Request:

```json
{
  "favorited": true
}
```

Response:

```json
{
  "favorited": true,
  "favorite_count": 6
}
```

### Comments API

#### GET /api/v1/posts/{post_id}/comments

获取博客评论。

Query:

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | integer | 否 | 页码 |
| page_size | integer | 否 | 每页数量 |

Response:

```json
{
  "items": [
    {
      "id": 1,
      "body": "好看！",
      "author": {
        "id": 2,
        "display_name": "Bob",
        "avatar_url": null
      },
      "parent_id": null,
      "created_at": "2026-05-20T10:10:00Z"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

#### POST /api/v1/posts/{post_id}/comments

创建评论或回复。

Auth: required

Request:

```json
{
  "body": "好看！",
  "parent_id": null
}
```

Response:

```json
{
  "id": 1,
  "body": "好看！",
  "parent_id": null,
  "created_at": "2026-05-20T10:10:00Z"
}
```

#### DELETE /api/v1/comments/{comment_id}

删除评论。

Auth: required，评论作者或管理员。

行为：将 `comments.status` 更新为 `deleted`。

### Collections API

#### POST /api/v1/collections

创建合集。

Auth: required

Request:

```json
{
  "title": "长篇合集",
  "description": "连载归档",
  "cover_asset_id": 10,
  "visibility": "public"
}
```

Response:

```json
{
  "id": 1,
  "title": "长篇合集",
  "visibility": "public",
  "created_at": "2026-05-20T10:00:00Z"
}
```

#### GET /api/v1/collections

获取合集列表。

Query:

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| owner_id | integer | 否 | 按作者过滤 |
| page | integer | 否 | 页码 |
| page_size | integer | 否 | 每页数量 |

#### GET /api/v1/collections/{collection_id}

获取合集详情和内容列表。

Response:

```json
{
  "id": 1,
  "title": "长篇合集",
  "description": "连载归档",
  "cover_url": "/uploads/2026/05/cover.png",
  "owner": {
    "id": 1,
    "display_name": "Alice",
    "avatar_url": null
  },
  "items": [
    {
      "post_id": 100,
      "title": "第一章 雨夜",
      "sort_order": 1
    }
  ]
}
```

#### PATCH /api/v1/collections/{collection_id}

编辑合集。

Auth: required，且必须是合集创建者。

#### DELETE /api/v1/collections/{collection_id}

删除合集。

Auth: required，且必须是合集创建者。

行为：将 `collections.status` 更新为 `deleted`，不删除原博客。

#### POST /api/v1/collections/{collection_id}/items

添加博客到合集。

Auth: required，且必须是合集创建者。

Request:

```json
{
  "post_id": 100,
  "sort_order": 1
}
```

#### PATCH /api/v1/collections/{collection_id}/items/{post_id}

调整合集内排序。

Auth: required，且必须是合集创建者。

Request:

```json
{
  "sort_order": 2
}
```

#### DELETE /api/v1/collections/{collection_id}/items/{post_id}

从合集中移除博客。

Auth: required，且必须是合集创建者。

### Search API

#### GET /api/v1/search

搜索博客、合集、作者和标签。

Query:

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| q | string | 是 | 搜索关键词 |
| type | string | 否 | `all`、`posts`、`collections`、`users`、`tags` |
| sort | string | 否 | `relevance`、`latest`、`hot` |
| page | integer | 否 | 页码 |
| page_size | integer | 否 | 每页数量 |

Response:

```json
{
  "items": [
    {
      "type": "post",
      "id": 100,
      "title": "第一章 雨夜",
      "summary": "正文摘要",
      "author_name": "Alice",
      "created_at": "2026-05-20T10:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

## 当前前端原型需要优先对接的接口

第一阶段只需要这些接口即可支撑当前三个页面：

1. `GET /api/v1/posts?tab=discover`：首页发现列表。
2. `GET /api/v1/posts?tab=following`：首页关注列表，未实现关注表时可先返回空列表。
3. `POST /api/v1/uploads/images`：上传页面图片上传。
4. `POST /api/v1/uploads/parse-document`：上传页面文档文字解析。
5. `POST /api/v1/posts`：上传页面发布或保存草稿。
6. `GET /api/v1/auth/me`：我的主页基础资料。
7. `GET /api/v1/users/me/posts`：我的主页发布内容。
8. `GET /api/v1/users/me/collections`：我的主页合集。
9. `GET /api/v1/search?q=...`：首页搜索框。

## 后续可扩展表

当前 skill 提到 `关注` 内容区，但后端设计暂不强制实现关注关系。后续可以增加：

### follows

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| follower_id | integer | PK, FK users.id | 发起关注的用户 |
| following_id | integer | PK, FK users.id | 被关注用户 |
| created_at | datetime | not null | 关注时间 |

约束：

- primary key(`follower_id`, `following_id`)
- 不允许 `follower_id = following_id`

## 安全与校验要点

- 注册和登录必须校验验证码有效期、用途、错误次数、是否已使用。
- 密码只保存 `password_hash`，禁止保存明文。
- 上传文件必须校验 MIME、扩展名、大小，不能只依赖前端限制。
- 文档解析失败时返回明确错误，不创建空正文。
- `.doc` 第一版建议返回 `UNSUPPORTED_FILE_TYPE`，提示用户转为 `.docx`。
- 创建、编辑、删除博客和合集必须校验资源所有权。
- 列表接口不能返回 `deleted`、`private` 且无权限的内容。
- 搜索第一版可使用 SQLite `LIKE`，数据量增大后再替换全文搜索。
