import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { TabView } from 'react-native-tab-view';

import { PostCard } from '../components/PostCard';
import { HomePostListSkeleton } from '../components/Skeleton';
import { styles } from '../components/styles';
import { useDelayedLoading } from '../hooks/useDelayedLoading';
import type { AuthSession } from '../services/authSession';
import { getDiscoverPosts, getFollowingPosts, getTagSuggestions, searchPostsByTitle, searchUsers, type Post, type UserSearchResult } from '../services/homeApi';
import { dislikePost } from '../services/postApi';
import { Ionicons } from '@expo/vector-icons';

type HomeScreenProps = {
  onOpenPost: (postId: number) => void;
  onOpenAuthor: (authorId: number) => void;
  onOpenTag: (tag: string) => void;
  session: AuthSession | null;
  selectedRouteTag?: string;
};

const PAGE_SIZE = 10;

export function HomeScreen({ onOpenPost, onOpenAuthor, onOpenTag, session, selectedRouteTag }: HomeScreenProps) {
  const [section, setSection] = useState<'discover' | 'following'>('discover');
  const [selectedTag, setSelectedTag] = useState<string | null>(selectedRouteTag ?? null);
  const [tagQuery, setTagQuery] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<UserSearchResult[]>([]);
  const [titleMatches, setTitleMatches] = useState<Post[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<Post[]>([]);
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [discoverPage, setDiscoverPage] = useState(0);
  const [followingPage, setFollowingPage] = useState(0);
  const [discoverHasMore, setDiscoverHasMore] = useState(true);
  const [followingHasMore, setFollowingHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [actionPostId, setActionPostId] = useState<number | null>(null);
  const [contentMessage, setContentMessage] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const layout = useWindowDimensions();

  const discoverSeed = useRef(Date.now());
  const isDiscover = section === 'discover';
  const tabIndex = isDiscover ? 0 : 1;
  const tabRoutes = [
    { key: 'discover', title: '发现' },
    { key: 'following', title: '关注' },
  ];
  const posts = isDiscover ? discoverPosts : followingPosts;
  const page = isDiscover ? discoverPage : followingPage;
  const hasMore = isDiscover ? discoverHasMore : followingHasMore;
  const showInitialSkeleton = useDelayedLoading(isInitialLoading && posts.length === 0, 300);

  useEffect(() => {
    let isMounted = true;
    async function loadInitialPosts() {
      setIsInitialLoading(true);
      try {
        await loadDiscoverPage(1, true, selectedRouteTag ?? null);
      } catch (error) {
        if (isMounted) {
          setContentMessage(error instanceof Error ? error.message : '内容加载失败');
        }
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    }
    void loadInitialPosts();
    return () => {
      isMounted = false;
    };
  }, [session?.accessToken]);

  useEffect(() => {
    const nextTag = selectedRouteTag ?? null;
    if (nextTag !== selectedTag) {
      void applyTag(nextTag);
    }
  }, [selectedRouteTag]);

  useEffect(() => {
    let isMounted = true;
    const query = tagQuery.trim();
    if (!query || selectedTag) {
      setTagSuggestions([]);
      setUserSuggestions([]);
      setTitleMatches([]);
      return;
    }
    async function loadSearchResults() {
      try {
        const [tags, users, posts] = await Promise.all([
          getTagSuggestions(query),
          searchUsers(query, session?.accessToken),
          searchPostsByTitle(query, session?.accessToken),
        ]);
        if (isMounted) {
          setTagSuggestions(tags);
          setUserSuggestions(users);
          setTitleMatches(posts.items);
        }
      } catch {
        if (isMounted) {
          setTagSuggestions([]);
          setUserSuggestions([]);
          setTitleMatches([]);
        }
      }
    }
    void loadSearchResults();
    return () => {
      isMounted = false;
    };
  }, [tagQuery, selectedTag, session?.accessToken]);

  useEffect(() => {
    if (section === 'following' && session?.accessToken && followingPage === 0) {
      void loadFollowingPage(1, session.accessToken, true);
    }
  }, [section, session, followingPage]);

  async function loadDiscoverPage(nextPage: number, replace = false, tagName = selectedTag) {
    setContentMessage('');
    const data = await getDiscoverPosts(nextPage, PAGE_SIZE, discoverSeed.current, tagName, session?.accessToken);
    setDiscoverPosts((currentPosts) => (replace ? data.items : appendUniquePosts(currentPosts, data.items)));
    setDiscoverHasMore(nextPage * PAGE_SIZE < data.total);
    setDiscoverPage(nextPage);
  }

  async function loadFollowingPage(nextPage: number, token: string, replace = false) {
    setContentMessage('');
    const data = await getFollowingPosts(nextPage, token, PAGE_SIZE);
    setFollowingPosts((currentPosts) => (replace ? data.items : appendUniquePosts(currentPosts, data.items)));
    setFollowingHasMore(nextPage * PAGE_SIZE < data.total);
    setFollowingPage(nextPage);
  }

  async function loadMore() {
    if (isLoadingMore || isRefreshing || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      if (isDiscover) {
        await loadDiscoverPage(page + 1);
      } else if (session?.accessToken) {
        await loadFollowingPage(page + 1, session.accessToken);
      }
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : '内容加载失败');
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function refresh() {
    setIsRefreshing(true);
    setContentMessage('');
    try {
      if (isDiscover) {
        discoverSeed.current = Date.now();
        await loadDiscoverPage(1, true, selectedTag);
      } else if (session?.accessToken) {
        await loadFollowingPage(1, session.accessToken, true);
      }
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : '内容加载失败');
    } finally {
      setIsRefreshing(false);
    }
  }

  function switchSection(nextSection: 'discover' | 'following') {
    setContentMessage('');
    setSection(nextSection);
    if (nextSection === 'following') {
      setFollowingPosts([]);
      setFollowingPage(0);
      setFollowingHasMore(true);
      if (session?.accessToken) {
        setIsInitialLoading(true);
        void loadFollowingPage(1, session.accessToken, true)
          .catch((error) => setContentMessage(error instanceof Error ? error.message : '内容加载失败'))
          .finally(() => setIsInitialLoading(false));
      }
    }
  }

  async function applyTag(tagName: string | null) {
    const normalized = tagName?.trim() || null;
    setSection('discover');
    setSelectedTag(normalized);
    setTagQuery('');
    setTagSuggestions([]);
    setUserSuggestions([]);
    setTitleMatches([]);
    setDiscoverPosts([]);
    setDiscoverPage(0);
    setDiscoverHasMore(true);
    setIsInitialLoading(true);
    discoverSeed.current = Date.now();
    try {
      await loadDiscoverPage(1, true, normalized);
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : '内容加载失败');
    } finally {
      setIsInitialLoading(false);
    }
  }

  function selectTag(tagName: string) {
    onOpenTag(tagName);
    void applyTag(tagName);
  }

  function clearTag() {
    onOpenTag('');
    void applyTag(null);
  }

  async function markPostDisliked(postId: number) {
    setActionPostId(null);
    if (!session?.accessToken) {
      setContentMessage('请先登录后再标记不喜欢。');
      return;
    }
    setDiscoverPosts((current) => current.filter((post) => post.id !== postId));
    setFollowingPosts((current) => current.filter((post) => post.id !== postId));
    try {
      await dislikePost(postId, session.accessToken);
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : '操作失败，请稍后重试。');
    }
  }

  function renderFooter() {
    if (showInitialSkeleton) {
      return <HomePostListSkeleton />;
    }
    if (isLoadingMore) {
      return <ActivityIndicator style={{ padding: 16 }} />;
    }
    if (contentMessage) {
      return <Text style={[styles.authApiHint, { color: '#a05d6f', padding: 16 }]}>{contentMessage}</Text>;
    }
    if (posts.length === 0) {
      return isDiscover ? <Text style={[styles.authApiHint, { padding: 16 }]}>{selectedTag ? '该标签下暂无博客。' : '暂无推荐博客。'}</Text> : null;
    }
    if (!hasMore) {
      return <Text style={[styles.authApiHint, { padding: 16 }]}>没有更多内容了</Text>;
    }
    return null;
  }

  function renderPostItem(item: Post) {
    return (
      <View>
        {actionPostId === item.id ? (
          <View style={styles.postCardActionMenuRow}>
            <Pressable style={styles.postCardActionButton} onPress={() => void markPostDisliked(item.id)}>
              <Text style={styles.postCardActionText}>不喜欢</Text>
            </Pressable>
            <Pressable style={[styles.postCardActionButton, styles.postCardActionButtonMuted]} onPress={() => setActionPostId(null)}>
              <Ionicons name="close" size={16} color="#a05d6f" />
            </Pressable>
          </View>
        ) : null}
        <PostCard
          post={item}
          showAuthor
          showStats
          onPress={() => {
            setActionPostId(null);
            onOpenPost(item.id);
          }}
          onLongPress={() => setActionPostId(item.id)}
          onOpenTag={selectTag}
        />
      </View>
    );
  }

  function renderHomeList(target: 'discover' | 'following') {
    const targetPosts = target === 'discover' ? discoverPosts : followingPosts;
    return (
      <View style={styles.homeScreen}>
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
              userSuggestions={userSuggestions}
              titleMatches={titleMatches}
              onChangeQuery={setTagQuery}
              onClearTag={clearTag}
              onOpenPost={onOpenPost}
              onOpenAuthor={onOpenAuthor}
              onSelectTag={selectTag}
              onSearchFocusChange={setIsSearchFocused}
            />
          ) : null}
          ListFooterComponent={target === section ? renderFooter : null}
          onEndReached={() => {
            if (target === section) void loadMore();
          }}
          onEndReachedThreshold={0.35}
          refreshing={target === section && isRefreshing}
          onRefresh={() => {
            if (target === section) void refresh();
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  return (
    <View style={styles.homeScreen}>
      <View style={styles.segmentedControl}>
        <Pressable
          style={[styles.segmentButton, isDiscover && styles.segmentButtonActive]}
          onPress={() => switchSection('discover')}
        >
          <Text style={[styles.segmentText, isDiscover && styles.segmentTextActive]}>发现</Text>
          <View style={[styles.segmentUnderline, isDiscover && styles.segmentUnderlineActive]} />
        </Pressable>
        <Pressable
          style={[styles.segmentButton, !isDiscover && styles.segmentButtonActive]}
          onPress={() => switchSection('following')}
        >
          <Text style={[styles.segmentText, !isDiscover && styles.segmentTextActive]}>关注</Text>
          <View style={[styles.segmentUnderline, !isDiscover && styles.segmentUnderlineActive]} />
        </Pressable>
      </View>

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
    </View>
  );
}

type DiscoverHeaderProps = {
  selectedTag: string | null;
  tagQuery: string;
  tagSuggestions: string[];
  userSuggestions: UserSearchResult[];
  titleMatches: Post[];
  onChangeQuery: (query: string) => void;
  onClearTag: () => void;
  onOpenPost: (postId: number) => void;
  onOpenAuthor: (authorId: number) => void;
  onSelectTag: (tag: string) => void;
  onSearchFocusChange: (isFocused: boolean) => void;
};

function DiscoverHeader({
  selectedTag,
  tagQuery,
  tagSuggestions,
  userSuggestions,
  titleMatches,
  onChangeQuery,
  onClearTag,
  onOpenPost,
  onOpenAuthor,
  onSelectTag,
  onSearchFocusChange,
}: DiscoverHeaderProps) {
  const hasQuery = tagQuery.trim().length > 0;
  const hasResults = userSuggestions.length > 0 || titleMatches.length > 0 || tagSuggestions.length > 0;

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
            placeholder="搜索用户、标题或 tag"
            placeholderTextColor="#9a8f8a"
            value={tagQuery}
            onChangeText={onChangeQuery}
            onFocus={() => onSearchFocusChange(true)}
            onBlur={() => onSearchFocusChange(false)}
          />
          {hasResults && (
            <View style={styles.suggestionPanel}>
              {userSuggestions.length > 0 ? <Text style={styles.suggestionSectionTitle}>用户</Text> : null}
              {userSuggestions.map((user) => (
                <Pressable key={`user-${user.id}`} style={styles.suggestionItem} onPress={() => onOpenAuthor(user.id)}>
                  <Text style={styles.suggestionText}>{user.display_name}</Text>
                  <Text style={styles.suggestionMeta}>@{user.username}{user.bio ? ` · ${user.bio}` : ''}</Text>
                </Pressable>
              ))}

              {titleMatches.length > 0 ? <Text style={styles.suggestionSectionTitle}>标题匹配</Text> : null}
              {titleMatches.map((post) => (
                <Pressable key={`post-${post.id}`} style={styles.suggestionItem} onPress={() => onOpenPost(post.id)}>
                  <Text style={styles.suggestionText}>{post.title}</Text>
                  <Text style={styles.suggestionMeta}>{post.author.display_name}{post.tags.length > 0 ? ` · #${post.tags.slice(0, 2).join(' #')}` : ''}</Text>
                </Pressable>
              ))}

              {tagSuggestions.length > 0 ? <Text style={styles.suggestionSectionTitle}>标签</Text> : null}
              {tagSuggestions.map((tag) => (
                <Pressable key={`tag-${tag}`} style={styles.suggestionItem} onPress={() => onSelectTag(tag)}>
                  <Text style={styles.suggestionText}>#{tag}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {hasQuery && !hasResults ? (
            <View style={styles.suggestionPanel}>
              <Text style={styles.suggestionEmptyText}>没有找到相关用户、标题或标签</Text>
            </View>
          ) : null}
        </>
      )}
      <Text style={styles.sectionTitle}>{selectedTag ? '标签博客' : '今日推荐'}</Text>
    </>
  );
}

function appendUniquePosts(currentPosts: Post[], incomingPosts: Post[]) {
  const existingIds = new Set(currentPosts.map((post) => post.id));
  return [...currentPosts, ...incomingPosts.filter((post) => !existingIds.has(post.id))];
}
