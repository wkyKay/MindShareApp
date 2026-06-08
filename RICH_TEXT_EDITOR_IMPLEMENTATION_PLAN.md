# Notion 风格富文本编辑器实施清单

## 目标

在现有项目中实现一套类 Notion 的富文本编辑能力，用于发布更复杂的帖子内容。第一阶段目标不是完全复刻 Notion，而是先完成一个稳定、可扩展、能体现技术亮点的 block editor 基础版本。

这套能力需要同时覆盖：

- 编辑能力
- 存储能力
- 阅读渲染能力
- 图片上传能力
- 后续扩展代码块、数学公式、颜色和更多 block 的能力

## 总体方案

采用以下架构：

- React Native 页面作为外壳
- `react-native-webview` 作为编辑容器
- WebView 内运行 `tiptap` 编辑器
- 后端存储结构化 `content_json`
- 阅读页使用 React Native 原生 block renderer 渲染，不依赖 WebView

原因：

- Web 生态里的 block editor 比 React Native 原生成熟得多
- `tiptap` 扩展性强，适合做类 Notion 的 block editor
- RN 原生阅读渲染更容易和现有 UI 保持一致
- 后续可以逐步加 slash command、代码块、LaTeX、拖拽排序等高级能力

## 第一阶段必须实现的功能

### 1. 基础 block

需要支持：

- 段落 `paragraph`
- 标题 `heading`
- 引用 `quote`
- 无序列表 `bullet list`
- 有序列表 `ordered list`
- 分割线 `divider`

### 2. 基础文本格式

需要支持：

- 加粗
- 斜体
- 下划线
- 行内代码

### 3. 图片插入

需要支持：

- 从手机选择图片
- 上传图片到后端
- 在编辑器中插入图片 block

### 4. 结构化保存

需要支持：

- 编辑器内容以 JSON 格式同步到 RN
- 发布时把 `content_json` 提交给后端
- 后端保存 `content_json`

### 5. 阅读态渲染

需要支持：

- 帖子详情页根据 `content_json` 原生渲染 block
- 标题、段落、引用、列表、图片正确显示

## 第二阶段增强功能

可以在第一阶段稳定后继续补：

- Slash command
- 代码块 + 语言选择
- LaTeX 公式
- 待办清单 block
- 颜色 / 高亮
- 自动保存草稿
- block 拖拽排序
- 自动目录

## 前端新增文件清单

### 页面层

- `react-app/src/screens/PostEditorScreen.tsx`
  - 富文本编辑页
- `react-app/src/screens/PostPreviewScreen.tsx`
  - 预览页，可选

### 编辑器桥接层

- `react-app/src/editor/EditorWebView.tsx`
  - 封装 WebView 编辑器
- `react-app/src/editor/editorBridge.ts`
  - RN 与 WebView 的消息收发逻辑
- `react-app/src/editor/editorMessageTypes.ts`
  - 定义双向通信协议

### WebView 内编辑器资源

- `react-app/src/editor/web/editor.html`
  - WebView 入口 HTML
- `react-app/src/editor/web/editor.ts`
  - 初始化 `tiptap`
- `react-app/src/editor/web/extensions/`
  - 自定义 extension 目录

建议至少包含：

- `heading.ts`
- `quote.ts`
- `divider.ts`
- `imageBlock.ts`
- `slashCommand.ts`（第二阶段可补）

### 阅读态渲染层

- `react-app/src/components/post-renderer/PostRenderer.tsx`
- `react-app/src/components/post-renderer/ParagraphBlock.tsx`
- `react-app/src/components/post-renderer/HeadingBlock.tsx`
- `react-app/src/components/post-renderer/QuoteBlock.tsx`
- `react-app/src/components/post-renderer/ListBlock.tsx`
- `react-app/src/components/post-renderer/ImageBlock.tsx`
- `react-app/src/components/post-renderer/DividerBlock.tsx`

### 类型与服务

- `react-app/src/types/postContent.ts`
  - block schema
- `react-app/src/services/postEditorApi.ts`
  - 编辑器发布 / 更新接口封装

### 草稿存储

- `react-app/src/stores/editorDraftStore.ts`
  - 本地草稿与恢复逻辑

## 后端改动清单

### 1. Post 模型增强

当前 `Post` 主要依赖 `body` 字段。建议新增：

- `content_json`

SQLite 第一阶段可以直接存字符串 JSON。

后续如果切 PostgreSQL，可迁移成 JSONB。

### 2. 接口增强

需要修改：

- `POST /api/v1/posts`
- `PATCH /api/v1/posts/{id}`
- `GET /api/v1/posts/{id}`

新增 / 返回字段：

- `content_json`

### 3. 摘要策略

发布时仍然保留：

- `summary`

推荐从 block 内容中提取纯文本前 100 到 200 字生成摘要。

## block 数据结构建议

建议在前端维护一个统一 schema，而不是直接把 `tiptap` 原始 JSON 暴露到所有业务层。

示例：

```ts
export type PostContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | QuoteBlock
  | DividerBlock
  | ImageBlock
  | ListBlock;

export type ParagraphBlock = {
  type: 'paragraph';
  text: RichTextSpan[];
};

export type HeadingBlock = {
  type: 'heading';
  level: 1 | 2 | 3;
  text: RichTextSpan[];
};

export type QuoteBlock = {
  type: 'quote';
  text: RichTextSpan[];
};

export type DividerBlock = {
  type: 'divider';
};

export type ImageBlock = {
  type: 'image';
  url: string;
  caption?: string;
  width?: number;
  height?: number;
};

export type ListBlock = {
  type: 'bullet_list' | 'ordered_list';
  items: { text: RichTextSpan[] }[];
};

export type RichTextSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  color?: string;
};
```

## RN 与 WebView 的通信协议

### WebView -> RN

```ts
type EditorToAppMessage =
  | { type: 'editor.ready' }
  | { type: 'editor.change'; content: unknown }
  | { type: 'editor.selection'; marks: string[]; blockType: string }
  | { type: 'editor.requestImagePick' };
```

### RN -> WebView

```ts
type AppToEditorMessage =
  | { type: 'editor.setContent'; content: unknown }
  | { type: 'editor.insertImage'; url: string }
  | { type: 'editor.command'; command: string };
```

## 图片上传链路

实现步骤：

1. 用户点击“插入图片”
2. WebView 发消息给 RN：`editor.requestImagePick`
3. RN 使用 `expo-image-picker`
4. RN 调现有上传接口
5. 上传成功后拿到图片 URL
6. RN 发消息给 WebView：`editor.insertImage`
7. WebView 插入 image block

## 依赖建议

前端依赖：

- `react-native-webview`
- `tiptap`
- `@tiptap/core`
- `@tiptap/starter-kit`
- `@tiptap/extension-image`
- `@tiptap/extension-underline`
- `expo-image-picker`
- `@react-native-async-storage/async-storage`

第二阶段再补：

- `katex`
- `prismjs`

## 第一阶段落地顺序

### Step 1

新增 `PostEditorScreen` 页面和一个最小 `EditorWebView`。

先做到：

- WebView 能展示一个可输入的 `tiptap` 编辑器

### Step 2

打通编辑器内容同步：

- WebView 内容变化后通过 `postMessage` 发给 RN
- RN 页面保存当前内容 state

### Step 3

增加基础工具栏：

- 加粗
- 斜体
- H1
- H2
- 列表
- 引用

### Step 4

支持图片上传与插入 block。

### Step 5

后端增加 `content_json` 存储。

### Step 6

详情页增加 `PostRenderer`，按 block 类型渲染内容。

### Step 7

发布链路改为提交：

- `title`
- `summary`
- `content_json`

## 技术亮点怎么体现

这个功能的亮点不在于“用了富文本库”，而在于：

- 自定义 block 内容协议
- RN 与 WebView 双向消息桥接
- 图片上传后回插编辑器
- 编辑态与阅读态分离
- 结构化 JSON 存储
- 后续可以无缝扩展代码块和数学公式

## 风险与注意事项

### 1. 不要一开始就追求完全复刻 Notion

Notion 真正难的是：

- block 间复杂光标行为
- 拖拽排序
- slash command
- 跨 block 选区
- 嵌套 block

第一阶段先把基础 block 稳住。

### 2. 编辑器存储格式不要直接耦合业务层

最好在：

- `tiptap` 原始 JSON
- 业务存储 schema

之间保留转换层。

### 3. 阅读页尽量不用 WebView

阅读态用原生组件渲染更稳定，也更容易接你现有 UI。

## 当前推荐执行结论

建议立刻开始做第一阶段，优先顺序如下：

1. `PostEditorScreen`
2. `EditorWebView`
3. 基础 block 与工具栏
4. `content_json` 存储
5. 原生 `PostRenderer`
6. 图片上传插入

如果第一阶段完成，这个项目的内容编辑能力就会比普通博客项目明显高一个层级。
