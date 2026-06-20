# AI 知识库博客内容 App

这是一个面向知识沉淀、博客发布和 AI 辅助阅读的全栈应用原型。项目由 Expo React Native 前端和 FastAPI 后端组成，支持账号认证、知识内容发布、标签浏览、评论互动、收藏合集、作者主页、私信通知、内容翻译缓存，以及 DeepSeek SSE 流式 AI 聊天。

## 项目结构

```text
react_proj/
  react-app/          # Expo React Native 前端，支持 iOS / Android / Web
  backend-server/     # FastAPI + SQLAlchemy 后端
```

## 技术栈

- 前端：`Expo`、`React Native`、`React 19`、`TypeScript`、`React Navigation`、`Zustand`、`AsyncStorage`、`i18next`
- 后端：`FastAPI`、`SQLAlchemy 2`、`SQLite`、`Pydantic`、`JWT`、`passlib[bcrypt]`
- 文档处理：`python-docx`、`pypdf`、`mammoth`、`markdownify`
- 实时/流式能力：私信与通知状态管理、AI 聊天 `text/event-stream` 流式响应
- 本地数据：`backend-server/forum.db`
- 本地上传：`backend-server/uploads/`，通过 `/uploads` 静态访问

## 核心功能

- 账号系统：验证码注册/登录、JWT 会话、当前用户信息、个人资料设置。
- 知识博客：发布、编辑、删除、草稿/公开状态、标题/摘要/正文/标签/封面。
- 内容浏览：首页内容流、标签筛选、博客详情、作者主页、个人发布列表。
- 互动关系：点赞、收藏、评论、回复、关注作者、浏览统计。
- 收藏与合集：个人收藏、合集管理、合集条目、删除内容脱敏展示。
- 消息通知：一对一私信、评论/点赞/关注通知、未读状态。
- 内容国际化：前端 i18n、本地 CJK 文案扫描、后端 UGC 翻译缓存接口。
- AI 助手：前端 AI 聊天页，后端通过 DeepSeek OpenAI-compatible API 提供需要登录的 SSE 流式聊天接口。
- 文件上传：图片、头像、封面和文档资源元信息；文档解析依赖已接入，适合扩展为知识库导入能力。

## 快速启动

### 1. 启动后端

在 `backend-server` 目录运行：

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

首次启动前，将 DeepSeek API Key 写入 `backend-server/.env`：

```env
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

默认地址：

- API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- 健康检查: `http://127.0.0.1:8000/health`
- 上传文件: `http://127.0.0.1:8000/uploads/...`

### 2. 启动前端

在 `react-app` 目录运行：

```bash
npm install
npm run start
```

常用平台命令：

```bash
npm run ios
npm run android
npm run web
```

前端 API 地址优先读取 `EXPO_PUBLIC_API_BASE_URL`。未设置时会使用 `react-app/src/config/api.ts` 中的本地兜底地址；真机调试时需要使用电脑的局域网 IP，并保证手机和电脑在同一网络。

## 前端入口与页面

前端入口：

```text
react-app/index.ts
react-app/App.tsx
```

主导航使用底部 Tab + Stack：

```text
home       # 知识内容首页
aiChat     # AI 助手
upload     # 发布内容
messages   # 私信和通知入口
profile    # 个人主页
```

主要页面：

```text
react-app/src/screens/HomeScreen.tsx
react-app/src/screens/AiChatScreen.tsx
react-app/src/screens/UploadScreen.tsx
react-app/src/screens/MessagesScreen.tsx
react-app/src/screens/ChatScreen.tsx
react-app/src/screens/NotificationScreen.tsx
react-app/src/screens/ProfileScreen.tsx
react-app/src/screens/BlogScreen.tsx
react-app/src/screens/AuthorScreen.tsx
react-app/src/screens/ProfileSettingsScreen.tsx
react-app/src/screens/ProfileAnalyticsScreen.tsx
```

## 后端 API 概览

后端入口是 `backend-server/app/main.py`，所有业务接口默认挂载在 `/api/v1` 下：

```text
/api/v1/auth           # 验证码、注册、登录、当前用户
/api/v1/users          # 用户资料、个人内容、关注关系
/api/v1/uploads        # 图片、头像、封面、文档上传
/api/v1/posts          # 知识博客增删改查、点赞、收藏、不感兴趣
/api/v1/posts/...      # 评论与回复接口
/api/v1/messages       # 会话和私信
/api/v1/collections    # 合集和合集条目
/api/v1/search         # 内容搜索
/api/v1/notifications  # 通知列表、已读状态
/api/v1/translations   # 内容翻译缓存
/api/v1/ai             # AI 聊天流式接口
```

AI 聊天接口：

```text
POST /api/v1/ai/chat/stream
```

该接口调用 DeepSeek 并返回 SSE 数据，用于前端流式消息渲染、自动滚动和中断请求逻辑。

DeepSeek 配置只放在后端环境变量或 `backend-server/.env` 中，不要写入前端代码：

```env
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

## 数据库与业务约定

当前使用 SQLite。后端启动时会通过 `init_db()` 和 SQLAlchemy `create_all()` 自动创建表，并在 `backend-server/app/database.py` 中执行少量 SQLite schema 补齐逻辑。

主要表：

- `users`、`captchas`：账号、验证码和登录信息。
- `posts`、`tags`、`post_tags`、`assets`：博客内容、标签和上传资源。
- `likes`、`favorites`、`post_dislikes`、`comments`、`comment_likes`：内容互动。
- `collections`、`collection_items`、`collection_favorites`：知识合集。
- `follows`：用户关注关系。
- `notifications`：评论、点赞、关注等通知。
- `conversations`、`conversation_participants`、`messages`：一对一私信。
- `translation_caches`：用户生成内容翻译缓存。

重要约定：

- 写操作需要登录，并通过 `Authorization: Bearer <access_token>` 鉴权。
- 前端会话保存在 `AsyncStorage`，key 为 `auth.session.v1`。
- 博客编辑和删除只能由作者执行。
- 博客删除采用软删除：`posts.status = "deleted"`。
- 收藏关系不会因博客删除而移除；删除态收藏卡片必须脱敏展示。
- 私有内容、私信和非公开内容的翻译需要权限校验。

## 开发检查

前端类型检查：

```bash
cd react-app
npm run typecheck
```

前端完整检查，包括 TypeScript 和未翻译 CJK 文案扫描：

```bash
cd react-app
npm run check
```

后端语法检查：

```bash
cd backend-server
python -m compileall app
```

## 当前定位

该项目目前是 AI 知识库博客内容 App 的本地原型，重点验证内容发布、知识组织、社交互动、消息通知和 AI 辅助入口的完整链路。生产化前建议补充真实大模型/翻译服务、对象存储、数据库迁移、权限测试、部署配置和更完整的端到端测试。
