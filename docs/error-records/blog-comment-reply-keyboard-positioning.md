# Blog 评论回复时键盘与目标评论定位记录

## 问题现象

- 在 Blog 详情页回复某条评论时，用户希望键盘刚好出现在该评论下方。
- 实际移动端键盘由系统控制，永远从屏幕底部弹出，业务代码不能改变键盘位置。
- 如果只聚焦底部输入框，键盘弹出后可能挡住评论区，用户输入时看不到正在回复的原评论。

## 根因

移动端输入法键盘不是 React Native 页面内的普通组件，不能像 View 一样被布局到某个评论卡片下方。

因此正确方向不是“移动键盘”，而是：

- 保持底部输入框负责输入。
- 键盘弹出时由页面全局 keyboard padding 顶起底部输入栏。
- 点击回复时，把被回复的评论滚动到键盘上方的可见区域。

## 修复方案

回复流程改为：

1. 点击评论的「回复」。
2. 记录 `replyingTo`。
3. 如果目标评论是折叠回复，先展开它所属的根评论。
4. 记录 `pendingReplyFocusId`。
5. 记录每条评论的真实 `y/height` 布局。
6. 记录 `FlatList` 可视高度和底部输入栏高度。
7. 等 `flatComments` 因展开完成、键盘弹出后，通过 `useScrollItemAboveKeyboard` 用高度差计算 `scrollToOffset`。
8. 让目标评论底部贴近输入栏上方，再高亮目标评论并聚焦底部输入框。

这样屏幕中上部能看到被回复评论，底部输入栏和键盘负责输入。

## 核心代码

封装位置：`react-app/src/hooks/useScrollItemAboveKeyboard.ts`

Hook 负责：

- 监听键盘高度。
- 记录列表可视高度。
- 记录底部输入栏高度。
- 注册每条评论的真实布局。
- 根据目标评论底部位置计算 `scrollToOffset`。

Hook 核心实现：

```tsx
export function useScrollItemAboveKeyboard<ItemT>() {
  const listRef = useRef<FlatList<ItemT>>(null);
  const itemLayouts = useRef(new Map<number, { y: number; height: number }>());
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [listViewportHeight, setListViewportHeight] = useState(0);
  const [bottomAccessoryHeight, setBottomAccessoryHeight] = useState(0);

  const registerItemLayout = useCallback((itemId: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    itemLayouts.current.set(itemId, { y, height });
  }, []);

  const scrollItemAboveKeyboard = useCallback((itemId: number, options: ScrollItemOptions) => {
    const gap = options.gap ?? 12;
    const layout = itemLayouts.current.get(itemId);
    if (layout && listViewportHeight > 0) {
      const targetOffset = Math.max(0, layout.y + layout.height - listViewportHeight + gap);
      listRef.current?.scrollToOffset({ offset: targetOffset, animated: options.animated ?? true });
      return;
    }

    listRef.current?.scrollToIndex({
      index: options.fallbackIndex,
      animated: options.animated ?? true,
      viewPosition: 1,
      viewOffset: gap,
    });
  }, [listViewportHeight]);

  return {
    bottomAccessoryHeight,
    handleBottomAccessoryLayout,
    handleListLayout,
    keyboardInset,
    listRef,
    registerItemLayout,
    scrollItemAboveKeyboard,
  };
}
```

`CommentSection` 使用 hook：

```tsx
const {
  bottomAccessoryHeight: composerHeight,
  handleBottomAccessoryLayout,
  handleListLayout,
  keyboardInset,
  listRef,
  registerItemLayout,
  scrollItemAboveKeyboard,
} = useScrollItemAboveKeyboard<FlatCommentItem>();
```

新增待定位状态：

```tsx
const [pendingReplyFocusId, setPendingReplyFocusId] = useState<number | null>(null);
const composerRef = useRef<TextInput>(null);
```

点击回复时先展开根评论，并记录待定位评论：

```tsx
function startReply(comment: CommentItem) {
  const rootId = findRootId(comment, commentsById);
  setReplyingTo(comment);
  setBody('');
  setExpandedRoots((current) => new Set(current).add(rootId));
  setPendingReplyFocusId(comment.id);
}
```

记录评论真实布局：

```tsx
<View
  style={[styles.commentThread, isReply && styles.commentReplyThread]}
  onLayout={(event) => registerItemLayout(comment.id, event)}
>
```

记录列表和输入栏高度，并给列表底部留出输入栏空间：

```tsx
<FlatList
  ref={listRef}
  contentContainerStyle={[styles.pageContent, bottomComposerEnabled && { paddingBottom: composerHeight + 24 }]}
  onLayout={handleListLayout}
/>

<View style={styles.blogBottomBarHost} onLayout={handleBottomAccessoryLayout}>
```

等待 `flatComments` 更新后聚焦输入框，并在键盘出现后按高度差定位：

```tsx
useEffect(() => {
  if (!pendingReplyFocusId || !flatComments.length) {
    return;
  }
  const targetIndex = flatComments.findIndex((item) => item.comment.id === pendingReplyFocusId);
  if (targetIndex < 0) {
    return;
  }
  composerRef.current?.focus();

  const delays = keyboardInset > 0 || Platform.OS === 'web' ? [80] : [120, 320];
  const timers = delays.map((delay) => setTimeout(() => {
    scrollItemAboveKeyboard(pendingReplyFocusId, { fallbackIndex: targetIndex });
    setHighlightedCommentId(pendingReplyFocusId);
    if (keyboardInset > 0 || Platform.OS === 'web' || delay === 320) {
      setPendingReplyFocusId(null);
    }
  }, delay));
  return () => timers.forEach((timer) => clearTimeout(timer));
}, [flatComments, keyboardInset, pendingReplyFocusId, scrollItemAboveKeyboard]);
```

## 关键点

- 不能只用固定 `viewPosition`，不同评论高度、键盘高度和输入栏高度都会让位置不准。
- 更可靠的方式是记录目标评论的 `layout.y + layout.height`，再减去列表可视高度，得到应该滚动到的 offset。
- 不要恢复评论卡片内嵌输入框，否则会重新引入键盘遮挡和布局跳动问题。
- 折叠回复必须先展开，再滚动；否则 `FlatList` 中找不到目标 index。
- 键盘避让应由外层统一处理，评论组件只负责定位目标内容。

## 验证

执行：

```bash
npx tsc --noEmit
```

结果：通过。
