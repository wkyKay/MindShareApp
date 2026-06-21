# AI 知识库博客内容 App Backend

这是 AI 知识库博客内容 App 的后端服务，基于 `FastAPI + SQLAlchemy + SQLite + JWT + 本地 uploads/` 构建。它为前端提供账号认证、知识博客、评论互动、收藏合集、用户关系、私信通知、内容翻译缓存和 AI 聊天流式接口。

## 目录结构

```text
backend-server/
  app/
    main.py              # FastAPI 入口，注册路由、挂载静态文件、初始化数据库
    database.py          # SQLite/SQLAlchemy engine、session、init_db schema 补齐
    models.py            # SQLAlchemy 数据模型
    schemas.py           # Pydantic 请求/响应模型
    auth.py              # 密码哈希、JWT 签发、当前用户鉴权
    notification_service.py
    realtime.py
    routers/
      auth.py            # 验证码、注册、登录、当前用户
      users.py           # 用户资料、个人内容、关注关系
      uploads.py         # 图片、头像、封面、文档上传
      posts.py           # 博客增删改查、点赞、收藏、不感兴趣
      comments.py        # 评论、回复、评论点赞
      messages.py        # 一对一私信会话和消息
      collections.py     # 合集和合集条目
      search.py          # 搜索
      notifications.py   # 通知列表和已读状态
      translations.py    # UGC 内容翻译缓存
      ai_chat.py         # DeepSeek SSE AI 聊天
  docs/
    backend-design.md    # 数据库与 API 设计文档
  uploads/               # 本地上传目录，通过 /uploads 静态访问
  requirements.txt       # Python 依赖
```

## 运行方式

在 `backend-server` 目录运行：

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

将真实 DeepSeek API Key 写入 `backend-server/.env` 后再启动后端。

默认服务地址：

- API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- 健康检查: `http://127.0.0.1:8000/health`
- 上传静态文件: `http://127.0.0.1:8000/uploads/...`

## 配置

- `DATABASE_URL`：可覆盖默认 SQLite 连接；未设置时使用 `sqlite:///./forum.db`。
- `SECRET_KEY`：JWT 签名密钥；未设置时仅使用本地开发默认值。
- `DEEPSEEK_API_KEY`：DeepSeek API Key，必须配置在后端环境变量中。
- `DEEPSEEK_BASE_URL`：DeepSeek OpenAI-compatible API 地址，默认 `https://api.deepseek.com`。
- `DEEPSEEK_MODEL`：DeepSeek 模型名，默认 `deepseek-chat`。
- `uploads/`：后端启动时自动创建，并挂载为 `/uploads`。

本地配置模板见 `.env.example`：

```env
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## 应用入口

后端入口是 `app/main.py` 中的 `app` 对象：

```bash
uvicorn app.main:app --reload
```

启动流程：

1. 调用 `init_db()` 初始化 SQLite 表结构。
2. 创建 `FastAPI(title="AI Knowledge Base Blog API", version="0.1.0")` 实例。
3. 注册 CORS，允许本地 Expo Web、模拟器和局域网调试地址访问。
4. 挂载 `/uploads` 静态目录。
5. 将业务 router 注册到 `/api/v1` 前缀下。
6. 提供 `/health` 健康检查接口。

## 路由概览

```text
/api/v1/auth           # 验证码、注册、登录、当前用户
/api/v1/users          # 用户资料、个人内容、关注关系
/api/v1/uploads        # 文件上传和文档解析入口
/api/v1/posts          # 博客增删改查、点赞、收藏、不感兴趣
/api/v1                # 评论相关路由
/api/v1/messages       # 私信会话和消息
/api/v1/collections    # 合集管理
/api/v1/search         # 搜索
/api/v1/notifications  # 通知
/api/v1/translations   # 内容翻译缓存
/api/v1/ai             # AI 聊天
/uploads               # 本地静态文件
/health                # 健康检查
```

## 主要能力

- 认证：验证码、注册、登录、JWT 鉴权、当前用户解析。
- 内容：知识博客发布、编辑、软删除、标签、封面、浏览与互动计数。
- 互动：点赞、收藏、不感兴趣、评论、回复、评论点赞。
- 关系：关注作者、作者主页、个人发布与收藏列表。
- 合集：创建合集、维护合集条目、收藏合集。
- 消息：一对一会话、消息发送、已读状态和隐藏会话。
- 通知：评论、回复、点赞、关注等通知聚合和未读状态。
- 翻译：对博客、评论、私信、合集字段做权限校验并缓存 mock 翻译结果。
- AI：`POST /api/v1/ai/chat/stream` 调用 DeepSeek 并返回 `text/event-stream` 流式回复。
- 上传：保存上传资源元信息，支持图片、头像、封面和文档类资源扩展。
  - **图片优化管线**：图片上传经过客户端 `expo-image-manipulator` 预缩放（1920px）和服务端 `Pillow` 处理（EXIF 纠正 → 转 WebP quality 80 → 生成 300px 缩略图），最终落地 `uploads/images/` 文件系统（不再 BLOB 入库）。新增 `/api/v1/uploads/assets/{id}/thumbnail` 缩略图端点，静态资源返回 `Cache-Control` + `ETag` 缓存头，上传大小限制 10MB。

## 数据库

默认数据库文件：

```text
backend-server/forum.db
```

主要表：

- `users`、`captchas`
- `posts`、`tags`、`post_tags`、`assets`
- `likes`、`favorites`、`post_dislikes`
- `comments`、`comment_likes`
- `collections`、`collection_items`、`collection_favorites`
- `follows`
- `notifications`
- `conversations`、`conversation_participants`、`messages`
- `translation_caches`

当前没有 Alembic 迁移流程。原型阶段由 `init_db()` 和 `create_all()` 管理表结构；表结构稳定后建议引入迁移工具。

## 开发检查

```bash
python -m compileall app
```

## 设计文档

更详细的数据库表、API 请求响应和安全校验见：

```text
docs/backend-design.md
```
