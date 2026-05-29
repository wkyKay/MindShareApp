# React Native 移动端项目优化指南

> 针对秋招竞争力提升的技术优化方案

## 一、性能优化（面试高频考点）

### 1. 列表性能优化

FlatList 是移动端性能的关键，以下是必须掌握的优化手段：

```tsx
<FlatList
  data={data}
  renderItem={renderItem}
  keyExtractor={(item) => String(item.id)}
  
  // 性能优化属性
  initialNumToRender={10}        // 首屏渲染数量
  maxToRenderPerBatch={10}       // 每批渲染数量
  windowSize={5}                 // 可视区域外缓存的屏幕数
  removeClippedSubviews={true}   // 移除屏幕外视图
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

**关键优化点：**
- **避免匿名函数**：`renderItem` 使用 `useCallback` 缓存
- **列表项 memo**：用 `React.memo` 包裹列表项组件
- **固定高度**：提供 `getItemLayout` 避免动态计算

### 2. 渲染优化

```tsx
// ✅ 使用 useMemo 缓存计算结果
const sortedData = useMemo(() => {
  return data.sort((a, b) => b.created_at - a.created_at);
}, [data]);

// ✅ 使用 useCallback 缓存回调
const handlePress = useCallback((id: number) => {
  navigation.navigate('Detail', { id });
}, [navigation]);

// ✅ 组件 memo 化
const PostCard = React.memo(({ post, onPress }: PostCardProps) => {
  return (
    <Pressable onPress={() => onPress(post.id)}>
      {/* ... */}
    </Pressable>
  );
});
```

### 3. 图片优化

- 使用适当尺寸的图片（根据设备像素比）
- 实现图片懒加载
- 使用 WebP 格式减少体积
- 添加图片占位符和加载动画

### 4. 启动优化

- **代码分割**：路由懒加载
- **减少首屏依赖**：非关键数据延迟加载
- **使用 Hermes 引擎**：提升启动速度

## 二、用户体验优化

### 1. 加载状态优化

**骨架屏 > Loading 动画 > 空白页面**

```tsx
// 骨架屏组件示例
const SkeletonCard = () => (
  <View style={styles.skeletonCard}>
    <View style={styles.skeletonAvatar} />
    <View style={styles.skeletonContent}>
      <View style={styles.skeletonTitle} />
      <View style={styles.skeletonText} />
    </View>
  </View>
);
```

### 2. 列表交互优化

- **下拉刷新**：`refreshControl`
- **上拉加载**：`onEndReached`
- **空状态**：列表为空时显示友好提示
- **错误重试**：加载失败提供重试按钮

### 3. 离线体验

```tsx
// 网络状态监听
import NetInfo from '@react-native-community/netinfo';

const [isConnected, setIsConnected] = useState(true);

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    setIsConnected(state.isConnected);
  });
  return () => unsubscribe();
}, []);
```

### 4. 数据缓存策略

```tsx
// 使用 MMKV 进行本地缓存
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

// 缓存数据
storage.set('posts', JSON.stringify(posts));

// 读取缓存
const cachedPosts = storage.getString('posts');
```

## 三、代码质量与工程化

### 1. TypeScript 规范

- 避免使用 `any`，使用 `unknown` + 类型守卫
- 定义完整的接口类型
- 使用泛型提高代码复用性

```tsx
// ✅ 好的实践
interface ApiResponse<T> {
  data: T;
  code: number;
  message: string;
}

// ❌ 避免
const fetchData = (): Promise<any> => { ... };
```

### 2. 状态管理选择

| 方案 | 适用场景 | 特点 |
|------|----------|------|
| useState/useContext | 小型应用 | 简单，无需额外依赖 |
| Zustand | 中小型应用 | 轻量，API 简洁 |
| Jotai/Recoil | 复杂状态 | 原子化，细粒度更新 |
| Redux Toolkit | 大型应用 | 生态完善，调试友好 |

### 3. 网络层封装

```tsx
// api/client.ts
class ApiClient {
  private baseURL: string;
  
  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }
  
  async request<T>(config: RequestConfig): Promise<T> {
    try {
      const response = await fetch(`${this.baseURL}${config.url}`, {
        ...config,
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          ...config.headers,
        },
      });
      
      if (!response.ok) {
        throw new ApiError(response.status, response.statusText);
      }
      
      return response.json();
    } catch (error) {
      // 统一错误处理
      handleApiError(error);
      throw error;
    }
  }
}
```

### 4. 项目结构规范

```
src/
  components/          # 通用组件
    common/           # 基础组件（Button、Input）
    business/         # 业务组件（PostCard）
  screens/            # 页面组件
  hooks/              # 自定义 Hooks
  services/           # API 服务
  stores/             # 状态管理
  utils/              # 工具函数
  constants/          # 常量定义
  types/              # 类型定义
```

## 四、可展示的技术亮点

### 1. 性能优化案例（简历/面试）

> "通过 FlatList 优化，列表滑动帧率从 30fps 提升到 55fps"

具体措施：
- 添加 `getItemLayout` 避免动态高度计算
- 使用 `React.memo` 包裹列表项
- 实现图片懒加载，首屏加载时间减少 40%

### 2. 完整功能闭环

当前项目功能：
- ✅ 用户认证（登录/注册）
- ✅ 内容发布（文章/图片）
- ✅ 内容列表（分页加载）
- ✅ 个人中心（资料/作品）

建议补充：
- 🔲 搜索功能（关键词 + 筛选）
- 🔲 消息通知（系统消息/互动提醒）
- 🔲 分享功能（生成海报/链接分享）

### 3. 技术栈升级方向

- **React Native 新架构**：了解 Fabric 和 TurboModules
- **TypeScript 深度使用**：类型体操、泛型约束
- **性能监控**：集成 Firebase Performance
- **CI/CD**：GitHub Actions 自动化构建

## 五、立即可做的优化清单

### 高优先级

- [ ] FlatList 添加性能优化属性
- [ ] 实现骨架屏组件
- [ ] 添加下拉刷新和上拉加载
- [ ] 统一错误处理

### 中优先级

- [ ] 图片懒加载实现
- [ ] 数据缓存策略
- [ ] 网络状态监听
- [ ] 添加 Error Boundary

### 低优先级

- [ ] 单元测试覆盖
- [ ] 性能监控接入
- [ ] 代码分割优化

## 六、面试常见问题

### Q1: 如何优化 FlatList 性能？

**回答要点：**
1. 使用 `getItemLayout` 提供固定高度
2. 设置 `initialNumToRender` 控制首屏渲染数量
3. 使用 `windowSize` 控制内存中保留的屏幕数
4. `renderItem` 使用 `useCallback` 缓存
5. 列表项组件使用 `React.memo`

### Q2: React Native 和 H5 的区别？

**回答要点：**
1. RN 使用原生组件渲染，H5 使用 WebView
2. RN 性能更好，体验更接近原生
3. RN 需要桥接原生模块，H5 可以直接使用浏览器 API
4. RN 包体积较大，H5 无需安装

### Q3: 如何处理 RN 的内存泄漏？

**回答要点：**
1. 组件卸载时取消订阅和定时器
2. 使用 `useEffect` 返回清理函数
3. 避免在闭包中引用已卸载组件的状态
4. 图片资源及时释放
5. 使用 `WeakRef` 管理缓存

## 七、高级功能技术亮点（秋招加分项）

### 1. 评论区系统（嵌套回复 + 点赞）

**技术难点：**
- 嵌套评论的递归渲染
- 评论的懒加载（分页）
- 实时点赞状态同步

**实现方案：**
```tsx
// 评论数据结构
interface Comment {
  id: number;
  content: string;
  author: User;
  created_at: string;
  like_count: number;
  is_liked: boolean;
  parent_id?: number;        // 回复的评论ID
  replies?: Comment[];       // 嵌套回复
  reply_count: number;       // 总回复数
}

// 递归渲染组件
const CommentItem = memo(({ comment, depth = 0 }: CommentItemProps) => {
  const [showReplies, setShowReplies] = useState(false);
  
  return (
    <View style={[styles.commentContainer, { marginLeft: depth * 20 }]}>
      <AuthorInfo user={comment.author} />
      <Text>{comment.content}</Text>
      <ActionBar 
        likeCount={comment.like_count}
        onReply={() => setReplyTo(comment.id)}
        onShowReplies={() => setShowReplies(!showReplies)}
      />
      {showReplies && comment.replies?.map(reply => (
        <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </View>
  );
});
```

**面试亮点：**
> "实现了嵌套评论系统，支持无限层级回复，使用虚拟列表优化大量评论的渲染性能"

---

### 2. 私信功能（WebSocket 实时通信）

**技术选型对比：**

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| WebSocket | 实时双向通信 | 需要维护连接 | 在线聊天 |
| 轮询 | 实现简单 | 实时性差 | 简单通知 |
| SSE | 服务器推送 | 单向通信 | 消息提醒 |

**推荐方案：WebSocket + 本地存储**

```tsx
// WebSocket 管理类
class ChatWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  connect(userId: number) {
    this.ws = new WebSocket(`wss://api.example.com/ws/chat?userId=${userId}`);
    
    this.ws.onmessage = (event) => {
      const message: ChatMessage = JSON.parse(event.data);
      this.saveToLocal(message);  // 保存到本地
      this.notifyUI(message);      // 通知UI更新
    };
    
    this.ws.onclose = () => {
      this.scheduleReconnect();   // 断线重连
    };
  }
  
  private saveToLocal(message: ChatMessage) {
    // 使用 MMKV 保存聊天记录
    const chatKey = `chat_${message.conversation_id}`;
    const history = storage.getString(chatKey);
    const messages = history ? JSON.parse(history) : [];
    messages.push(message);
    storage.set(chatKey, JSON.stringify(messages));
  }
}

// 使用
const ChatScreen = ({ conversationId }: ChatScreenProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  useEffect(() => {
    // 1. 加载本地历史记录
    const localHistory = loadLocalMessages(conversationId);
    setMessages(localHistory);
    
    // 2. 连接 WebSocket
    chatWS.connect(currentUser.id);
    
    // 3. 同步服务器历史（分页加载）
    fetchServerHistory(conversationId).then(serverMessages => {
      mergeMessages(localHistory, serverMessages);
    });
  }, [conversationId]);
};
```

**数据存储策略：**
- **本地存储（MMKV/AsyncStorage）**：聊天记录、草稿
- **数据库存储（SQLite）**：消息索引、会话列表
- **服务器存储**：消息持久化、多端同步

**面试亮点：**
> "实现了基于 WebSocket 的实时私信系统，支持断线重连、消息本地缓存、已读回执，参考小红书的消息架构设计"

---

### 3. 富文本编辑器（图片上传 + 文字格式）

**技术方案：**

```tsx
// 使用 react-native-pell-rich-editor
import RichEditor from 'react-native-pell-rich-editor';

const UploadScreen = () => {
  const richText = useRef<RichEditor>(null);
  
  const insertImage = async () => {
    const image = await ImagePicker.launchImageLibraryAsync();
    const uploadedUrl = await uploadImage(image.uri);
    
    // 插入图片到编辑器
    richText.current?.insertImage(uploadedUrl, 'image');
  };
  
  const handleSubmit = async () => {
    const htmlContent = await richText.current?.getContentHtml();
    // 提交到服务器
    await createPost({ content: htmlContent });
  };
  
  return (
    <View>
      <RichEditor
        ref={richText}
        placeholder="写点什么..."
        actions={[
          'bold',
          'italic',
          'underline',
          'heading1',
          'insertImage',
        ]}
        onPressAddImage={insertImage}
      />
    </View>
  );
};
```

**安全清洗（XSS 防护）：**

```tsx
import DOMPurify from 'dompurify';

const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'img'],
    ALLOWED_ATTR: ['src', 'alt', 'class'],
  });
};
```

**面试亮点：**
> "实现了富文本编辑器，支持图片插入和文字格式化，前端进行 XSS 安全清洗，后端二次校验"

---

### 4. AI 接入（SSE 流式输出）

**技术方案：**

```tsx
// SSE 流式处理
const useAIStream = () => {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  
  const startStream = async (prompt: string) => {
    setIsStreaming(true);
    setContent('');
    
    const response = await fetch('/api/ai/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          setContent(prev => prev + data.content);
        }
      }
    }
    
    setIsStreaming(false);
  };
  
  return { content, isStreaming, startStream };
};
```

**面试亮点：**
> "接入了 AI 文档补全功能，使用 SSE 实现流式输出，优化首屏响应时间，提升用户体验"

---

### 5. 数据可视化（ECharts / Ant Design Mobile）

**技术方案：**

```tsx
// 使用 @wuba/react-native-echarts
import { ECharts } from '@wuba/react-native-echarts';

const TagAnalysisChart = ({ data }: { data: TagData[] }) => {
  const option = {
    tooltip: {
      trigger: 'item',
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: data.map(item => ({
          name: item.tag,
          value: item.count,
        })),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };
  
  return <ECharts option={option} style={{ height: 300 }} />;
};
```

**个人主页数据分析：**

```tsx
const ProfileAnalytics = () => {
  const [activeTab, setActiveTab] = useState<'posts' | 'favorites'>('posts');
  
  const { data: tagStats } = useQuery(
    ['tagStats', activeTab],
    () => fetchTagStats(activeTab)
  );
  
  return (
    <View>
      <SegmentedControl
        values={['发布分析', '收藏分析']}
        onChange={(index) => setActiveTab(index === 0 ? 'posts' : 'favorites')}
      />
      <TagAnalysisChart data={tagStats} />
      <StatsSummary stats={calculateStats(tagStats)} />
    </View>
  );
};
```

**面试亮点：**
> "使用 ECharts 实现个人数据可视化，分析用户发布和收藏的内容标签分布，帮助用户了解自己的兴趣偏好"

---

### 6. 搜索功能升级（分词 + 高亮）

**技术方案：**

```tsx
// 分词搜索
const useSearch = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  
  const search = useCallback(async (keyword: string) => {
    // 1. 分词处理
    const tokens = segment(keyword);  // 使用分词库
    
    // 2. 多字段搜索
    const response = await fetch('/api/search', {
      method: 'POST',
      body: JSON.stringify({
        keywords: tokens,
        fields: ['title', 'content', 'tags'],
        highlight: true,
      }),
    });
    
    setResults(await response.json());
  }, []);
  
  return { results, search };
};

// 高亮显示
const HighlightText = ({ text, keyword }: HighlightProps) => {
  const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
  
  return (
    <Text>
      {parts.map((part, i) => 
        part.toLowerCase() === keyword.toLowerCase() ? (
          <Text key={i} style={styles.highlight}>{part}</Text>
        ) : (
          part
        )
      )}
    </Text>
  );
};
```

**面试亮点：**
> "实现了智能搜索功能，支持中文分词、多字段匹配、结果高亮，搜索响应时间 < 200ms"

---

## 八、技术亮点总结（简历写法）

### 项目描述示例

> **同人论坛移动端应用**
> 
> 技术栈：React Native + TypeScript + FastAPI + WebSocket + ECharts
> 
> 核心功能：
> - 实现富文本编辑器，支持图文混排和 AI 辅助写作（SSE 流式输出）
> - 设计 WebSocket 实时通信架构，支持私信、评论实时通知
> - 使用 ECharts 实现数据可视化，分析用户内容偏好
> - 优化 FlatList 性能，列表滑动帧率稳定在 55fps+
> 
> 技术亮点：
> - 前端 XSS 安全清洗 + 后端二次校验的双重安全机制
> - WebSocket 断线重连 + 消息本地缓存的可靠性设计
> - 分词搜索 + 结果高亮的智能搜索方案

### 面试准备要点

1. **能讲清楚架构设计** - 画图说明 WebSocket 通信流程
2. **能说出技术选型原因** - 为什么选择 WebSocket 而不是轮询
3. **能解决实际问题** - 如何处理消息丢失、重复等问题
4. **能体现学习能力** - 如何调研小红书、微信的 IM 方案

## 九、更多技术亮点（大厂必备技能）

### 1. 微信生态接入（登录 + 分享）

**技术方案：**

```tsx
// 使用 react-native-wechat-lib
import * as WeChat from 'react-native-wechat-lib';

// 初始化
WeChat.registerApp('wx1234567890');

// 微信登录
const wxLogin = async () => {
  try {
    const authRes = await WeChat.sendAuthRequest('snsapi_userinfo');
    // 将 code 传给后端换取 access_token 和用户信息
    const userInfo = await backendLogin(authRes.code);
    return userInfo;
  } catch (error) {
    console.error('微信登录失败:', error);
  }
};

// 分享朋友圈
const shareToTimeline = async (post: Post) => {
  await WeChat.shareTimeline({
    type: 'news',
    title: post.title,
    description: post.summary,
    thumbImage: post.cover_url,
    webpageUrl: `https://yourapp.com/post/${post.id}`,
  });
};

// 分享小程序（更高级）
const shareMiniProgram = async (post: Post) => {
  await WeChat.shareMiniProgram({
    title: post.title,
    userName: 'gh_xxxxxxxxxxx',  // 小程序原始ID
    path: `/pages/post/detail?id=${post.id}`,
    thumbImage: post.cover_url,
    miniProgramType: 0,  // 0-正式版 1-测试版 2-体验版
  });
};
```

**面试亮点：**
> "接入微信开放平台，实现微信登录、朋友圈分享、小程序跳转，提升用户获取和留存"

---

### 2. 高流量页面性能优化（数据预加载 + 降级策略）

#### 数据"抢跑"加载

```tsx
// 使用 React Navigation 的 useFocusEffect 提前加载
import { useFocusEffect } from '@react-navigation/native';

const HomeScreen = () => {
  const queryClient = useQueryClient();
  
  // 页面聚焦时预加载下一页数据
  useFocusEffect(
    useCallback(() => {
      // 预加载热门内容
      queryClient.prefetchQuery(['hotPosts'], fetchHotPosts);
      
      // 预加载用户推荐
      queryClient.prefetchQuery(['recommendations'], fetchRecommendations);
    }, [])
  );
  
  return <HomeContent />;
};

// 路由级预加载
const AppNavigator = () => {
  const navigation = useNavigation();
  
  const navigateToDetail = (postId: number) => {
    // 先预加载数据
    prefetchPostDetail(postId);
    
    // 再跳转页面
    navigation.navigate('Detail', { postId });
  };
};
```

#### 超时降级策略

```tsx
const useResilientRequest = () => {
  const requestWithFallback = async <T,>(
    requestFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    timeout: number = 5000
  ): Promise<T> => {
    try {
      // 主请求带超时
      const result = await Promise.race([
        requestFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);
      return result as T;
    } catch (error) {
      console.warn('主请求失败/超时，使用降级方案');
      // 降级方案：本地缓存、简化数据等
      return fallbackFn();
    }
  };
  
  return { requestWithFallback };
};

// 使用示例
const HomeScreen = () => {
  const { requestWithFallback } = useResilientRequest();
  
  const loadPosts = async () => {
    const posts = await requestWithFallback(
      () => fetchPostsFromServer(),  // 主请求
      () => fetchPostsFromCache(),   // 降级：本地缓存
      3000  // 3秒超时
    );
    setPosts(posts);
  };
};
```

#### 客户端重试机制

```tsx
const fetchWithRetry = async <T,>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  backoff: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error as Error;
      
      // 指数退避
      const delay = backoff * Math.pow(2, i);
      console.log(`第 ${i + 1} 次重试，等待 ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};
```

**面试亮点：**
> "设计高流量页面的性能优化方案，实现数据预加载、超时降级、指数退避重试，保证用户体验的稳定性"

---

### 3. i18n 国际化（出海项目必备）

**技术方案：**

```tsx
// 使用 i18next + react-i18next
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 语言资源配置
const resources = {
  zh: {
    translation: {
      home: {
        title: '首页',
        welcome: '欢迎回来',
      },
      post: {
        create: '发布文章',
        placeholder: '写点什么...',
      },
    },
  },
  en: {
    translation: {
      home: {
        title: 'Home',
        welcome: 'Welcome back',
      },
      post: {
        create: 'Create Post',
        placeholder: 'Write something...',
      },
    },
  },
  ja: {
    translation: {
      home: {
        title: 'ホーム',
        welcome: 'お帰りなさい',
      },
      post: {
        create: '投稿する',
        placeholder: '何か書いてください...',
      },
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'zh',  // 默认语言
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

// 组件中使用
const HomeScreen = () => {
  const { t, i18n } = useTranslation();
  
  return (
    <View>
      <Text>{t('home.title')}</Text>
      <Text>{t('home.welcome')}</Text>
      
      {/* 语言切换 */}
      <Button 
        title="切换英文" 
        onPress={() => i18n.changeLanguage('en')} 
      />
    </View>
  );
};
```

#### AST 扫描未翻译字段（工程化工具）

```javascript
// scripts/i18n-scan.js
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const scanUntranslatedStrings = (dir) => {
  const untranslated = [];
  
  const scanFile = (filePath) => {
    const code = fs.readFileSync(filePath, 'utf-8');
    
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
    
    traverse(ast, {
      // 扫描 JSX 文本
      JSXText(path) {
        const text = path.node.value.trim();
        if (text && !text.match(/^\s*$/)) {
          untranslated.push({
            file: filePath,
            type: 'JSXText',
            text: text,
            line: path.node.loc?.start.line,
          });
        }
      },
      
      // 扫描字符串字面量
      StringLiteral(path) {
        const text = path.node.value;
        // 过滤掉已使用 t() 的字符串
        if (isChinese(text) && !isInTFunction(path)) {
          untranslated.push({
            file: filePath,
            type: 'StringLiteral',
            text: text,
            line: path.node.loc?.start.line,
          });
        }
      },
    });
  };
  
  // 递归扫描目录
  const scanDir = (dir) => {
    fs.readdirSync(dir).forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(tsx?|jsx?)$/.test(file)) {
        scanFile(fullPath);
      }
    });
  };
  
  scanDir(dir);
  return untranslated;
};

// 生成报告
const report = scanUntranslatedStrings('./src');
console.table(report);
```

**面试亮点：**
> "实现 i18n 国际化方案，支持多语言切换；开发 AST 扫描工具自动检测未翻译字段，提升国际化开发效率"

---

### 4. 动效优化（原生级体验）

#### 手势滑动动画

```tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDecay,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const SwipeableCard = ({ item, onDismiss }: SwipeableCardProps) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const context = useSharedValue({ x: 0, y: 0 });
  
  const gesture = Gesture.Pan()
    .onStart(() => {
      context.value = { x: translateX.value, y: translateY.value };
    })
    .onUpdate((event) => {
      translateX.value = context.value.x + event.translationX;
      translateY.value = context.value.y + event.translationY;
    })
    .onEnd((event) => {
      // 滑动超过阈值，移除卡片
      if (Math.abs(translateX.value) > 100) {
        translateX.value = withSpring(Math.sign(translateX.value) * 500);
        onDismiss(item.id);
      } else {
        // 回弹
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${translateX.value * 0.05}deg` },
    ],
  }));
  
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {/* 卡片内容 */}
      </Animated.View>
    </GestureDetector>
  );
};
```

#### 页面转场动画

```tsx
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

const screenOptions = {
  cardStyleInterpolator: ({ current, layouts }) => ({
    cardStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [layouts.screen.width, 0],
          }),
        },
      ],
    },
  }),
};

<Stack.Navigator screenOptions={screenOptions}>
  <Stack.Screen name="Home" component={HomeScreen} />
  <Stack.Screen name="Detail" component={DetailScreen} />
</Stack.Navigator>
```

**面试亮点：**
> "使用 Reanimated 2 实现原生级手势动画，包括卡片滑动、页面转场，提升用户交互体验"

---

## 十、完整技术栈总结（简历黄金模板）

### 项目描述（可直接复制使用）

> **同人论坛移动端应用**
> 
> 技术栈：React Native + TypeScript + FastAPI + WebSocket + ECharts + i18n + 微信SDK
> 
> **核心功能：**
> - 实现富文本编辑器，支持图文混排和 AI 辅助写作（SSE 流式输出）
> - 设计 WebSocket 实时通信架构，支持私信、评论实时通知
> - 接入微信生态，实现微信登录、分享、小程序跳转
> - 使用 ECharts 实现数据可视化，分析用户内容偏好
> - 实现 i18n 国际化，支持中英日三语言切换
> 
> **性能优化：**
> - 优化 FlatList 性能，列表滑动帧率稳定在 55fps+
> - 设计数据预加载 + 超时降级 + 重试机制，保证高流量页面稳定性
> - 实现骨架屏、图片懒加载、数据缓存，首屏加载时间减少 40%
> 
> **技术亮点：**
> - 前端 XSS 安全清洗 + 后端二次校验的双重安全机制
> - WebSocket 断线重连 + 消息本地缓存的可靠性设计
> - 开发 AST 扫描工具自动检测未翻译字段，提升国际化效率
> - 使用 Reanimated 2 实现原生级手势动画

### 面试准备清单

**必须能讲清楚的技术点：**

1. **WebSocket 通信流程** - 画图说明连接建立、消息收发、断线重连
2. **性能优化思路** - 从测量到优化的完整流程
3. **i18n 实现方案** - 语言切换、资源加载、AST 扫描原理
4. **降级策略设计** - 什么场景降级、如何降级、如何恢复
5. **微信 SDK 接入** - 授权流程、分享原理、小程序跳转

**建议准备的 Demo：**
- 手势滑动卡片效果
- 骨架屏加载动画
- 语言切换实时生效
- 网络断线提示和重试

## 十一、移动端常用技术亮点速查（按技术栈分类）

> 以下列出移动端 App 开发中常用的技术亮点，标 ⭐ 为强烈推荐项

---

### 一、性能优化技术栈

#### ⭐ 1. 列表性能优化
```
技术栈：FlatList + react-native-reanimated
亮点：虚拟列表、手势滑动、流畅度 55fps+
面试话术："通过 getItemLayout 和 React.memo 优化，列表滑动帧率稳定在 55fps+"
```

#### ⭐ 2. 图片优化
```
技术栈：react-native-fast-image + react-native-image-resizer
亮点：缓存策略、渐进加载、WebP 格式
面试话术："使用 react-native-fast-image 实现图片缓存和渐进加载，减少 40% 流量消耗"
```

#### 3. 启动优化
```
技术栈：Hermes 引擎 + Code Splitting + 预加载
亮点：TTI 时间 < 1.5s、包体积优化
面试话术："启用 Hermes 引擎，实现代码分割和懒加载，启动时间减少 30%"
```

---

### 二、用户体验技术栈

#### ⭐ 4. 骨架屏 + 加载状态
```
技术栈：react-native-skeleton-placeholder / 自定义
亮点：感知性能提升、减少白屏时间
面试话术："实现骨架屏组件，提升 perceived performance，减少用户等待焦虑"
```

#### ⭐ 5. 动画系统
```
技术栈：react-native-reanimated 2 + react-native-gesture-handler
亮点：手势驱动动画、60fps 流畅交互
面试话术："使用 Reanimated 2 实现原生级手势动画，包括卡片滑动、页面转场"
```

#### 6. 下拉刷新 + 上拉加载
```
技术栈：@shopify/flash-list + react-native-reanimated
亮点：iOS/Android 原生体验
面试话术："封装通用列表组件，支持下拉刷新、上拉加载、空状态、错误重试"
```

---

### 三、数据管理技术栈

#### ⭐ 7. 状态管理
```
技术栈：Zustand / Jotai / Redux Toolkit
亮点：轻量级、TypeScript 友好、调试工具
面试话术："使用 Zustand 替代 Redux，减少样板代码，提升开发效率"
```

#### ⭐ 8. 数据缓存
```
技术栈：react-query / SWR + MMKV
亮点：自动缓存、后台刷新、乐观更新
面试话术："使用 react-query 实现数据缓存和后台刷新，减少不必要请求"
```

#### 9. 离线优先
```
技术栈：WatermelonDB / Realm + NetInfo
亮点：离线可用、数据同步、冲突解决
面试话术："设计离线优先架构，网络恢复后自动同步数据"
```

---

### 四、原生能力技术栈

#### ⭐ 10. 推送通知
```
技术栈：react-native-firebase (FCM) + Notifee
亮点：远程推送、本地通知、富媒体通知
面试话术："集成 Firebase Cloud Messaging，实现推送通知和本地提醒"
```

#### 11. 深度链接
```
技术栈：react-native-deep-linking + Universal Links
亮点：分享回流、广告归因、快捷入口
面试话术："实现深度链接，支持分享回流和广告归因追踪"
```

#### 12. 生物识别
```
技术栈：react-native-biometrics / LocalAuthentication
亮点：指纹/面容登录、安全支付
面试话术："集成生物识别，实现指纹/面容登录，提升安全性和便捷性"
```

---

### 五、工程技术栈

#### ⭐ 13. 热更新
```
技术栈：CodePush / Expo Updates
亮点：无需审核、即时修复、灰度发布
面试话术："集成 CodePush 实现热更新，线上 Bug 即时修复，无需等待审核"
```

#### ⭐ 14. 性能监控
```
技术栈：Firebase Performance / Sentry
亮点：崩溃分析、性能追踪、用户行为
面试话术："接入 Sentry 和 Firebase Performance，实现崩溃监控和性能追踪"
```

#### 15. 自动化构建
```
技术栈：Fastlane + GitHub Actions / GitLab CI
亮点：自动打包、签名、上传 TestFlight/Play Store
面试话术："配置 Fastlane + GitHub Actions，实现自动化构建和发布"
```

---

### 六、安全相关技术栈

#### 16. 安全存储
```
技术栈：react-native-keychain / react-native-encrypted-storage
亮点：Keychain/Keystore 存储、加密敏感数据
面试话术："使用 Keychain/Keystore 安全存储 Token，防止数据泄露"
```

#### 17. 证书锁定
```
技术栈：react-native-ssl-pinning
亮点：防止中间人攻击、API 安全
面试话术："实现 SSL Pinning，防止中间人攻击，保障 API 通信安全"
```

---

### 七、跨平台技术栈

#### 18. 新架构适配
```
技术栈：Fabric (新渲染器) + TurboModules + JSI
亮点：同步调用、性能提升、C++ 共享代码
面试话术："了解 React Native 新架构，Fabric 渲染器和 JSI 同步调用机制"
```

#### 19. 跨平台组件库
```
技术栈：React Native Paper / NativeBase / Tamagui
亮点：设计系统、主题切换、无障碍支持
面试话术："使用 React Native Paper 构建设计系统，支持主题切换和无障碍访问"
```

---

### 八、AI/智能化技术栈

#### 20. 端侧 AI
```
技术栈：TensorFlow Lite / ONNX Runtime
亮点：本地推理、隐私保护、实时识别
面试话术："集成 TensorFlow Lite，实现端侧 AI 推理，保护用户隐私"
```

#### 21. 智能输入
```
技术栈：AI 自动补全 + 语音转文字
亮点：提升输入效率、用户体验
面试话术："接入 AI 辅助输入和语音识别，提升内容创作效率"
```

---

## 十二、技术亮点选择建议

### 按面试场景推荐

| 面试公司类型 | 推荐技术亮点 | 原因 |
|-------------|-------------|------|
| 大厂（阿里/字节/腾讯）| 性能优化 + 工程化 + 新架构 | 重视深度和广度 |
| 外企（出海业务）| i18n + 安全 + 性能监控 | 重视国际化和稳定性 |
| 创业公司 | 热更新 + 推送 + 深度链接 | 重视快速迭代和增长 |
| 金融/支付 | 安全存储 + 生物识别 + SSL Pinning | 重视安全性 |

### 按技术深度推荐

**初级（0-2年）：**
- ⭐ FlatList 优化
- ⭐ 骨架屏
- ⭐ 下拉刷新/上拉加载
- 基础状态管理

**中级（2-4年）：**
- ⭐ 动画系统
- ⭐ 数据缓存
- ⭐ 热更新
- ⭐ 性能监控
- 推送通知

**高级（4年+）：**
- ⭐ 新架构适配
- ⭐ 离线优先
- ⭐ 自动化构建
- 端侧 AI
- 安全方案

---

## 十三、简历技术栈写法模板

### 简洁版（适合一页简历）

```
技术栈：React Native + TypeScript + Zustand + react-query + Reanimated 2

核心能力：
- 性能优化：FlatList 虚拟列表优化、图片懒加载、启动时间优化
- 用户体验：骨架屏、手势动画、下拉刷新、离线优先
- 原生能力：推送通知、深度链接、生物识别登录
- 工程化：热更新、性能监控、自动化构建
```

### 详细版（适合技术博客或详细简历）

```
移动端开发专家 | React Native

【技术栈】
React Native · TypeScript · Zustand · react-query · Reanimated 2 · Firebase

【性能优化】
• 列表优化：FlatList + getItemLayout + React.memo，滑动帧率 55fps+
• 图片优化：react-native-fast-image 缓存 + WebP 格式，节省 40% 流量
• 启动优化：Hermes 引擎 + 代码分割，TTI < 1.5s

【用户体验】
• 动画系统：Reanimated 2 手势驱动动画，60fps 流畅交互
• 加载优化：骨架屏 + 渐进加载，提升感知性能
• 离线优先：WatermelonDB + 自动同步，离线可用

【工程化】
• 热更新：CodePush 灰度发布，线上 Bug 即时修复
• 监控体系：Sentry 崩溃监控 + Firebase Performance 性能追踪
• CI/CD：Fastlane + GitHub Actions 自动化构建发布

【安全】
• 安全存储：Keychain/Keystore 存储敏感数据
• 通信安全：SSL Pinning 防止中间人攻击
```

---

> 持续更新中，建议定期回顾和补充实际项目中的优化经验。
