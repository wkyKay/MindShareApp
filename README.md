# React Project Tongren Forum

这是一个同人博客/论坛原型应用，包含 Expo React Native 前端和 FastAPI 后端。当前版本支持账号注册登录、发布博客、查看个人主页、博客详情、点赞、收藏、作者编辑/删除，以及删除博文在收藏列表中的脱敏展示。

## 项目结构

```text
react_proj/
  react-app/          # Expo React Native 前端
  backend-server/     # FastAPI + SQLite 后端
```

## 技术栈

- 前端：`Expo`、`React Native`、`React Navigation`、`AsyncStorage`、`TypeScript`
- 后端：`FastAPI`、`SQLAlchemy`、`SQLite`、`JWT`、`Pydantic`
- 本地存储：`backend-server/forum.db`
- 上传目录：`backend-server/uploads/`

## 启动后端

在 `backend-server` 目录运行：

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

默认地址：

- API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- 健康检查: `http://127.0.0.1:8000/health`

## 启动前端

在 `react-app` 目录运行：

```bash
npm install
npm run start
```

常用命令：

```bash
npm run ios
npm run android
npm run web
```

前端 API 地址配置在：

```text
react-app/src/config/api.ts
```

真机调试时，需要确保手机和电脑在同一网络，并把 API 地址配置为电脑局域网 IP。

## 前端页面

当前前端入口是：

```text
react-app/App.tsx
```

路由使用 React Navigation：

```text
home     # 首页
upload   # 发布博客
profile  # 我的主页
auth     # 登录/注册
blog     # 博客详情
```

主要页面文件：

```text
react-app/src/screens/HomeScreen.tsx
react-app/src/screens/UploadScreen.tsx
react-app/src/screens/ProfileScreen.tsx
react-app/src/screens/AuthScreen.tsx
react-app/src/screens/BlogScreen.tsx
```

## 核心功能

### 账号认证

- 注册和登录需要验证码。
- 登录成功后后端返回 `access_token`。
- 前端通过 `AsyncStorage` 保存会话，key 为 `auth.session.v1`。
- 后续需要登录的接口使用请求头：`Authorization: Bearer <access_token>`。

### 博客发布

- 发布页面调用 `POST /api/v1/posts`。
- 支持标题、正文、标签、公开/草稿状态。
- 博客正文当前以纯文本保存，后续可扩展 Markdown 渲染。

### 博客详情

- `PostCard` 可点击进入 `BlogScreen`。
- 详情接口：`GET /api/v1/posts/{post_id}`。
- 非作者可以点赞、收藏。
- 作者可以编辑、删除。
- 评论入口暂未实现。

### 删除策略

博客删除采用软删除：

```text
posts.status = 'deleted'
```

删除不会移除 `favorites` 收藏关系。这样收藏过该博文的用户仍能在个人收藏列表看到一个灰色占位卡片，但不会看到原博文标题、作者、摘要和统计信息。

### 个人主页

个人主页包含：

- 我的发布
- 我的收藏
- 我的合集

收藏列表接口会返回 `published` 和 `deleted` 博文。删除态数据会被后端脱敏，前端显示灰色 `已删除` 卡片。

## 后端 API 概览

基础前缀：

```text
/api/v1
```

主要接口：

```text
GET    /auth/captcha
POST   /auth/register
POST   /auth/login
GET    /auth/me

GET    /posts
POST   /posts
GET    /posts/{post_id}
PATCH  /posts/{post_id}
DELETE /posts/{post_id}
POST   /posts/{post_id}/like
POST   /posts/{post_id}/favorite

GET    /users/me/posts
GET    /users/me/favorites
GET    /users/me/collections

GET    /collections/{collection_id}
```

更完整的数据库和 API 设计见：

```text
backend-server/docs/backend-design.md
```

## 数据库设计

当前使用 SQLite，启动后端时通过 SQLAlchemy `create_all` 自动创建表。主要表包括：

- `users`：用户账号和主页信息
- `captchas`：登录/注册验证码
- `posts`：博客主体
- `tags` / `post_tags`：标签和博客标签关系
- `likes`：点赞关系，`user_id + post_id` 唯一
- `favorites`：收藏关系，`user_id + post_id` 唯一
- `collections` / `collection_items`：合集和合集内容
- `comments`：评论，当前前端暂未实现评论功能
- `assets`：上传资源元信息

原型阶段没有使用 Alembic。后续如果表结构稳定，建议引入数据库迁移。

## 重要业务约定

- 写操作必须登录。
- 博客编辑和删除只能由作者执行。
- 删除博客使用软删除，不物理删除原记录。
- 被删除博客不能继续点赞或收藏。
- 删除态收藏项必须脱敏，不返回原标题、摘要、作者名和统计数据。
- 前端根据 `is_owner` 判断显示作者操作还是普通用户操作。
- 前端根据 `is_deleted` 渲染灰色删除态卡片。

## 开发检查

前端类型检查：

```bash
cd react-app
npx tsc --noEmit
```

后端语法检查：

```bash
cd backend-server
python -m compileall app
```

## 当前限制

- 首页仍使用本地示例数据，后续应接入 `GET /api/v1/posts`。
- 上传接口和文档解析仍是原型能力。
- 评论功能后端有设计，前端暂未接入。
- 关注流、搜索、合集管理仍需继续完善。
- SQLite 适合本地原型，不建议直接用于生产环境。
