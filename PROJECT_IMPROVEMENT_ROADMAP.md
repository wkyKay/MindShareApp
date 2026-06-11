# 项目工程化改进路线

本文档用于规划 `react-app` 与 `backend-server` 的后续改进方向，目标是让项目在秋招简历和面试中更有竞争力。优先级按照“最值得做、最容易体现工程能力、最适合写进简历”的顺序排列。

## 1. 封装前端 API SDK

优先级：最高

当前前端已经有多个 `services/*Api.ts` 文件，可以进一步抽象为统一的业务 SDK，减少页面层对请求细节的感知。

建议结构：

```text
src/sdk/
  client.ts          # 请求核心：baseURL、鉴权、错误处理、JSON 解析
  errors.ts          # ApiError、错误码定义
  auth.ts            # 登录、注册、验证码、当前用户
  posts.ts           # 帖子列表、详情、发布、编辑、点赞、收藏
  comments.ts        # 评论、回复、评论点赞
  messages.ts        # 私信、会话、WebSocket 地址
  notifications.ts   # 通知、未读数、已读
  uploads.ts         # 图片、文档上传与解析
  ai.ts              # AI SSE 流式聊天
  types.ts           # 公共类型定义
```

建议实现能力：

- 统一处理 `baseURL`。
- 自动注入 `Authorization: Bearer <token>`。
- 统一解析响应和错误。
- 支持 `AbortSignal` 取消请求。
- 支持文件上传。
- 支持 SSE 流式响应。
- 集中管理请求/响应 TypeScript 类型。

简历表述：

> 封装 TypeScript 业务 API SDK，统一处理鉴权 Token、错误模型、请求取消、文件上传和 SSE 流式响应，降低页面层与接口实现耦合，提升接口调用的类型安全和可维护性。

## 2. 建立统一错误处理体系

优先级：最高

将后端接口错误统一映射成前端可识别的错误对象，避免每个页面重复处理异常。

建议定义：

```ts
class ApiError extends Error {
  status: number;
  code?: string;
  detail?: unknown;
}
```

建议覆盖场景：

- `401`：登录失效，引导重新登录。
- `403`：权限不足，展示无权限提示。
- `404`：资源不存在。
- `422`：表单校验失败。
- `500`：服务端异常，展示兜底提示。
- 网络错误：提示网络连接失败。

简历表述：

> 设计统一错误处理机制，将接口异常标准化为 `ApiError`，页面层根据错误类型完成登录失效、权限不足、表单校验失败和网络异常等分支处理。

## 3. 补充自动化测试

优先级：高

项目功能已经较多，建议优先为核心业务补后端接口测试和前端 SDK 单元测试。

后端建议使用：

- `pytest`
- `fastapi.testclient.TestClient`
- 测试数据库使用临时 SQLite

优先测试模块：

- 注册、登录、验证码校验。
- JWT 鉴权与无权限访问。
- 帖子发布、编辑、删除。
- 评论、回复、评论删除。
- 点赞、收藏唯一约束。
- 私信会话权限与未读数。
- 通知创建与标记已读。

前端建议测试：

- SDK 成功响应解析。
- SDK 错误响应解析。
- Token 注入逻辑。
- SSE 分片解析逻辑。

简历表述：

> 使用 `pytest` 为认证、帖子、评论、私信等核心接口编写自动化测试，覆盖鉴权、权限校验、异常分支和数据一致性场景。

## 4. 完善 README、接口文档与架构图

优先级：高

秋招项目不仅要能跑，还要能让面试官快速看懂。建议补充一份清晰的项目说明。

建议补充内容：

- 项目背景与核心功能。
- 前后端技术栈。
- 本地启动方式。
- 环境变量说明。
- 主要页面截图。
- API 文档地址。
- 数据库核心表设计。
- 项目架构图。
- WebSocket / SSE 通信流程图。

推荐文档结构：

```text
README.md
docs/
  architecture.md
  api.md
  database.md
  realtime.md
  deployment.md
```

简历表述：

> 编写项目架构文档、接口说明和实时通信流程图，沉淀前后端模块边界、数据模型和核心业务链路，提升项目可维护性和交接效率。

## 5. 引入 Alembic 数据库迁移

优先级：高

当前后端使用 `init_db()` / `create_all()` 更适合原型阶段。建议引入 `Alembic` 管理数据库表结构演进。

建议改进：

- 初始化 Alembic。
- 生成第一版迁移脚本。
- 后续表结构修改都通过 migration 管理。
- 在 README 中记录迁移命令。

简历表述：

> 引入 Alembic 管理数据库版本迁移，替代原型阶段自动建表方案，支持表结构可追踪演进和多环境一致部署。

## 6. 支持 PostgreSQL 与环境化配置

优先级：中高

SQLite 适合本地开发，但真实部署和面试表达中，支持 PostgreSQL 更有工程价值。

建议改进：

- 使用 `DATABASE_URL` 环境变量配置数据库。
- 本地默认 SQLite。
- 生产环境支持 PostgreSQL。
- 敏感配置全部改为环境变量。

建议环境变量：

```env
DATABASE_URL=sqlite:///./forum.db
SECRET_KEY=replace-me
ACCESS_TOKEN_EXPIRE_MINUTES=10080
UPLOAD_STORAGE=database
AI_PROVIDER=mock
```

简历表述：

> 支持 SQLite / PostgreSQL 多环境数据库配置，并通过环境变量管理数据库连接、JWT 密钥、上传策略和 AI Provider，实现开发与生产环境解耦。

## 7. 部署上线与 Docker 化

优先级：中高

能访问的 Demo 会显著增强项目说服力。

建议目标：

- 后端使用 Docker 封装。
- 后端部署到 Render、Railway、Fly.io 或云服务器。
- 前端使用 Expo Go 演示，或构建 Web 版本部署到 Vercel。
- README 中提供线上访问地址和测试账号。

建议补充文件：

```text
backend-server/Dockerfile
backend-server/.dockerignore
docker-compose.yml
docs/deployment.md
```

简历表述：

> 使用 Docker 封装 FastAPI 后端服务并完成云端部署，支持移动端通过公网 API 访问，实现项目从本地原型到可演示 Demo 的交付闭环。

## 8. 优化 WebSocket 实时通信可靠性

优先级：中高

当前项目已有私信和通知 WebSocket，可以继续补充弱网和异常场景处理。

建议改进：

- 前端 WebSocket 断线重连。
- 心跳检测。
- 消息去重。
- 已读状态同步。
- 未读数兜底刷新。
- 页面进入前后台后的重连策略。

简历表述：

> 优化 WebSocket 实时通信链路，支持断线重连、心跳检测、消息去重和未读数同步，提升移动端弱网场景下的消息可靠性。

## 9. 接入真实 AI Provider

优先级：中

当前 AI 聊天链路已经具备 SSE 流式输出能力，但后端回复仍是 mock。建议抽象 AI Provider，支持 mock 与真实模型切换。

建议 Provider：

- `mock`
- `deepseek`
- `openai-compatible`
- `ollama`

建议结构：

```text
backend-server/app/ai/
  providers.py
  mock_provider.py
  openai_provider.py
```

建议环境变量：

```env
AI_PROVIDER=mock
AI_API_BASE_URL=https://api.deepseek.com
AI_API_KEY=xxx
AI_MODEL=deepseek-chat
```

简历表述：

> 设计 AI Provider 抽象层，支持 mock 与 OpenAI-compatible 大模型服务切换，并通过 SSE 向移动端流式返回生成结果。

## 10. 优化上传存储方案

优先级：中

当前上传文件可以存入数据库二进制字段，适合原型阶段。后续建议改成文件内容与元数据分离。

建议改进：

- 数据库只保存文件元数据。
- 文件内容保存到本地文件系统或对象存储。
- 支持文件大小限制。
- 校验 MIME 类型和后缀。
- 图片访问通过静态资源或签名 URL。

可选存储：

- 本地 uploads 目录。
- 阿里云 OSS。
- AWS S3。
- Cloudflare R2。

简历表述：

> 重构资源上传模块，将文件元数据与文件内容分离存储，支持图片/文档类型校验、大小限制和静态资源访问，降低数据库膨胀风险。

## 11. 加强安全性

优先级：中

建议补充认证、上传和配置层面的安全校验。

建议改进：

- 生产环境强制配置 `SECRET_KEY`。
- 登录失败次数限制。
- 验证码过期和最大错误次数已经有雏形，可继续完善。
- 密码复杂度校验。
- 上传文件大小限制。
- 上传 MIME 类型校验。
- CORS 白名单环境化。
- 接口访问频率限制。

简历表述：

> 完善认证与上传安全校验，包括验证码过期控制、登录失败限制、JWT 鉴权、文件类型/大小限制和 CORS 环境化配置。

## 12. 性能与体验优化

优先级：中

前端已经有分页、Skeleton 和长列表，可以继续做体验优化。

前端建议：

- 搜索输入防抖。
- FlatList 参数优化。
- 图片懒加载与占位图。
- 页面级错误边界。
- 请求取消，避免页面切换后更新卸载组件。
- 乐观更新点赞、收藏、评论。

后端建议：

- 优化列表查询，减少 N+1 查询。
- 给高频查询字段补索引。
- 点赞数、评论数、收藏数保持缓存字段一致性。
- 分页参数统一校验。

简历表述：

> 针对移动端信息流场景优化分页加载、骨架屏、搜索防抖和列表渲染，并在后端通过索引和计数字段缓存提升高频查询性能。

## 推荐执行顺序

如果时间只有 1 到 2 周，建议按以下顺序做：

1. 封装前端 API SDK。
2. 建立统一错误处理体系。
3. 补充后端核心接口测试。
4. 完善 README、接口文档和架构图。
5. 完成 Docker 化或至少部署后端 Demo。

如果时间有 3 到 4 周，建议继续做：

1. 引入 Alembic 数据库迁移。
2. 支持 PostgreSQL 与环境化配置。
3. 优化 WebSocket 断线重连和未读数同步。
4. 接入真实 AI Provider。
5. 重构上传存储方案。

## 最适合写进简历的最终亮点

完成上述改进后，项目可以总结为：

- 前后端分离移动端社区系统。
- 自研 TypeScript API SDK。
- JWT 鉴权与统一错误处理。
- WebSocket 实时私信和通知。
- SSE AI 流式聊天。
- 文档解析与内容发布。
- Alembic 数据库迁移。
- PostgreSQL 生产环境支持。
- Docker 部署与自动化测试。

## 总结

当前项目已经具备较完整的社区业务功能，后续不建议继续优先堆页面。最值得投入的是 SDK 封装、错误处理、测试、文档、部署、数据库迁移和实时通信可靠性。这些改进更能体现工程能力，也更适合在秋招简历和面试中展开说明。
