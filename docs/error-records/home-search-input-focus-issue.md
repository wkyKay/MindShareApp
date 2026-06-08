# HomeScreen 搜索框无法输入问题记录

## 问题现象

- 移动端点击 HomeScreen 的 tag 搜索框时，键盘无法正常弹出，或弹出后立刻收起。
- Web 端搜索框无法连续输入文字，表现为输入一个字符后立刻失焦。
- 问题发生在 Home 的「发现」页搜索框。

## 影响范围

- 文件：`react-app/src/screens/HomeScreen.tsx`
- 组件：`HomeScreen` 中发现页的 tag 搜索输入框。
- 相关容器：`FlatList`、`TabView`。

## 前因

Home 页之前为了支持「发现 / 关注」左右滑动，使用了 `react-native-tab-view`：

```tsx
<TabView
  navigationState={{ index: tabIndex, routes: tabRoutes }}
  renderScene={({ route }) => renderHomeList(route.key as 'discover' | 'following')}
  renderTabBar={() => null}
  onIndexChange={(nextIndex) => switchSection(nextIndex === 0 ? 'discover' : 'following')}
  initialLayout={{ width: layout.width }}
  style={styles.homeScreen}
  lazy
/>
```

发现页列表使用 `FlatList`，搜索框放在 `ListHeaderComponent` 中。旧代码大致如下：

```tsx
function renderDiscoverHeader() {
  return (
    <>
      <TextInput
        style={styles.searchInput}
        placeholder="输入 tag 搜索博客"
        value={tagQuery}
        onChangeText={setTagQuery}
      />
    </>
  );
}

<FlatList
  contentContainerStyle={styles.pageContent}
  data={targetPosts}
  renderItem={({ item }) => renderPostItem(item)}
  keyExtractor={(item) => String(item.id)}
  ListHeaderComponent={target === 'discover' ? renderDiscoverHeader : null}
/>
```

## 根因

核心原因是：`ListHeaderComponent` 接收了一个在每次 `HomeScreen` render 时都会重新创建的函数组件引用。

当用户输入时：

1. `TextInput` 触发 `onChangeText`。
2. `setTagQuery` 更新状态。
3. `HomeScreen` 重新 render。
4. `renderDiscoverHeader` 函数引用变化。
5. `FlatList` 认为 Header 组件发生变化，可能重新挂载 Header。
6. Header 内部的 `TextInput` 被重新创建，导致焦点丢失。

因此不同平台出现了不同表现：

- 移动端：输入框刚获得焦点就被重挂载，键盘无法稳定弹出。
- Web 端：输入后立刻失焦，无法连续输入。

另一个加重因素是 `TabView` 的横向滑动手势可能和输入框触摸竞争，尤其在移动端更明显。

## 修复方案

修复分三部分：

1. 把发现页 Header 抽成稳定的 `DiscoverHeader` 组件。
2. `FlatList` 增加 `keyboardShouldPersistTaps="handled"`，避免点击建议项或输入区域时键盘被列表默认行为收起。
3. 搜索框聚焦时禁用 `TabView` 横向滑动，避免 Pager 手势抢占输入框触摸。

## 修复后的核心代码

`HomeScreen` 增加搜索聚焦状态：

```tsx
const [isSearchFocused, setIsSearchFocused] = useState(false);
```

`FlatList` 使用稳定的 Header 元素，并保留键盘点击：

```tsx
<FlatList
  style={styles.homeScreen}
  contentContainerStyle={styles.pageContent}
  data={targetPosts}
  renderItem={({ item }) => renderPostItem(item)}
  keyExtractor={(item) => String(item.id)}
  ListHeaderComponent={target === 'discover' ? (
    <DiscoverHeader
      selectedTag={selectedTag}
      tagQuery={tagQuery}
      tagSuggestions={tagSuggestions}
      onChangeQuery={setTagQuery}
      onClearTag={clearTag}
      onSelectTag={selectTag}
      onSearchFocusChange={setIsSearchFocused}
    />
  ) : null}
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
/>
```

`TabView` 在搜索框聚焦时关闭横向滑动：

```tsx
<TabView
  navigationState={{ index: tabIndex, routes: tabRoutes }}
  renderScene={({ route }) => renderHomeList(route.key as 'discover' | 'following')}
  renderTabBar={() => null}
  onIndexChange={(nextIndex) => switchSection(nextIndex === 0 ? 'discover' : 'following')}
  initialLayout={{ width: layout.width }}
  style={styles.homeScreen}
  swipeEnabled={!isSearchFocused}
  lazy
/>
```

稳定的 `DiscoverHeader`：

```tsx
type DiscoverHeaderProps = {
  selectedTag: string | null;
  tagQuery: string;
  tagSuggestions: string[];
  onChangeQuery: (query: string) => void;
  onClearTag: () => void;
  onSelectTag: (tag: string) => void;
  onSearchFocusChange: (isFocused: boolean) => void;
};

function DiscoverHeader({
  selectedTag,
  tagQuery,
  tagSuggestions,
  onChangeQuery,
  onClearTag,
  onSelectTag,
  onSearchFocusChange,
}: DiscoverHeaderProps) {
  return (
    <>
      {selectedTag ? (
        <View style={styles.selectedTagRow}>
          <Text style={styles.selectedTagText}>#{selectedTag}</Text>
          <Pressable onPress={onClearTag}>
            <Text style={styles.backButtonText}>清除</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            style={styles.searchInput}
            placeholder="输入 tag 搜索博客"
            placeholderTextColor="#9a8f8a"
            value={tagQuery}
            onChangeText={onChangeQuery}
            onFocus={() => onSearchFocusChange(true)}
            onBlur={() => onSearchFocusChange(false)}
          />
          {tagSuggestions.length > 0 && (
            <View style={styles.suggestionPanel}>
              {tagSuggestions.map((tag) => (
                <Pressable key={tag} style={styles.suggestionItem} onPress={() => onSelectTag(tag)}>
                  <Text style={styles.suggestionText}>#{tag}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
      <Text style={styles.sectionTitle}>{selectedTag ? '标签博客' : '今日推荐'}</Text>
    </>
  );
}
```

## 验证

执行类型检查：

```bash
npx tsc --noEmit
```

结果：通过。

## 经验总结

- `FlatList.ListHeaderComponent` 中包含 `TextInput` 时，不要传入每次 render 都重新创建且会被当成新组件的函数引用。
- 如果 Header 内有受控输入框，优先使用稳定组件或直接传 React element。
- 使用 `TabView`、Pager、Swipeable 等手势容器包裹输入框时，要关注手势竞争问题。
- 搜索输入类场景可以在输入框聚焦期间临时禁用横向滑动，换取稳定输入体验。
