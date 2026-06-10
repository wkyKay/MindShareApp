# Tongren Forum Backend

cd /Users/kayw/Documents/test_project/react_proj/backend-server
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
同人论坛后端服务，基于 `FastAPI + SQLite + SQLAlchemy + JWT + 本地 uploads/` 的第一版原型。

## 目录结构

```text
backend-server/
  app/
    __init__.py
    main.py              # FastAPI 应用入口，注册路由、挂载静态文件、初始化数据库表
    database.py          # SQLite 连接、SQLAlchemy engine/session、get_db 依赖
    models.py            # SQLAlchemy 数据模型：用户、验证码、文章、资源、合集、互动等
    schemas.py           # Pydantic 请求/响应模型
    auth.py              # 密码哈希、JWT 签发与当前用户鉴权
    routers/
      __init__.py
      auth.py            # 验证码、注册、登录、当前用户接口
      users.py           # 用户资料、我的文章、我的合集接口
      uploads.py         # 图片上传、文档解析接口
      posts.py           # 文章增删改查、点赞、收藏接口
      comments.py        # 评论列表、创建、删除接口
      collections.py     # 合集增删改查、合集条目管理接口
      search.py          # 搜索接口
  docs/
    backend-design.md    # 后端数据库与 API 设计文档
  uploads/               # 本地上传文件目录，通过 /uploads 静态访问
  requirements.txt       # Python 依赖
  venv/                  # 本地虚拟环境，不属于业务代码
```

## 运行方式

在 `backend-server` 目录下运行：

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

默认服务地址：

- API: `http://127.0.0.1:8000`
- Swagger 文档: `http://127.0.0.1:8000/docs`
- 健康检查: `http://127.0.0.1:8000/health`
- 上传静态文件: `http://127.0.0.1:8000/uploads/...`

## 应用入口

后端入口是 `app/main.py` 中的 `app` 对象：

```bash
uvicorn app.main:app --reload
```

这条命令含义：

- `app.main`：导入 `app/main.py` 模块。
- `app`：使用该模块里的 `FastAPI(...)` 实例。
- `--reload`：开发模式，代码变更后自动重启服务。

## 启动逻辑

启动时 `app/main.py` 会执行以下流程：

1. 导入 `models` 和数据库 `engine`。
2. 执行 `models.Base.metadata.create_all(bind=engine)`，根据 `models.py` 自动创建 SQLite 表。
3. 创建 FastAPI 实例：`FastAPI(title="Tongren Forum API", version="0.1.0")`。
4. 挂载本地上传目录：`/uploads -> uploads/`。
5. 注册各业务 router 到 `/api/v1` 前缀下。
6. 提供 `/health` 健康检查接口。

SQLite 数据库文件使用 `app/database.py` 中的配置：

```text
sqlite:///./forum.db
```

因此从 `backend-server` 目录启动时，数据库文件会生成在：

```text
backend-server/forum.db
```

## 当前路由

`app/main.py` 当前注册的路由前缀：

```text
/api/v1/auth         # auth.router
/api/v1/users        # users.router
/api/v1/uploads      # uploads.router
/api/v1/posts        # posts.router
/api/v1              # comments.router
/api/v1/collections  # collections.router
/api/v1/search       # search.router
/uploads             # 本地静态文件
/health              # 健康检查
```

第一阶段前端优先对接的接口见 `docs/backend-design.md`。

## 当前实现状态

当前代码是可启动的后端原型，登录注册已接入 SQLite：

- `app/auth.py` 负责密码哈希、JWT 签发和 `/auth/me` 的当前用户解析。
- `app/routers/auth.py` 的注册、登录会持久化用户、校验验证码、校验密码并签发 JWT。
- 上传接口目前只校验扩展名并返回示例响应，还没有保存文件或解析文档正文。
- 文章、合集、评论、搜索等接口大多返回空列表或示例数据，尚未接入数据库查询。
- `create_all` 适合原型阶段，结构稳定后建议迁移到 Alembic。

## 设计文档

详细数据库表、API 请求响应、安全校验和第一阶段接口优先级见：

```text
docs/backend-design.md
```
