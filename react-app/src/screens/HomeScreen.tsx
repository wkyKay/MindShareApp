import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { PostCard } from '../components/PostCard';
import { HomePostListSkeleton } from '../components/Skeleton';
import { styles } from '../components/styles';
import type { AuthSession } from '../services/authSession';
import { getDiscoverPosts, getFollowingPosts, getTagSuggestions, type Post } from '../services/homeApi';

type HomeScreenProps = {
  onOpenPost: (postId: number) => void;
  onOpenTag: (tag: string) => void;
  session: AuthSession | null;
  selectedRouteTag?: string;
};

const PAGE_SIZE = 10;

export function HomeScreen({ onOpenPost, onOpenTag, session, selectedRouteTag }: HomeScreenProps) {
  const [section, setSection] = useState<'discover' | 'following'>('discover');
  const [selectedTag, setSelectedTag] = useState<string | null>(selectedRouteTag ?? null);
  const [tagQuery, setTagQuery] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [discoverPosts, setDiscoverPosts] = useState<Post[]>([]);
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [discoverPage, setDiscoverPage] = useState(0);
  const [followingPage, setFollowingPage] = useState(0);
  const [discoverHasMore, setDiscoverHasMore] = useState(true);
  const [followingHasMore, setFollowingHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [contentMessage, setContentMessage] = useState('');

  const discoverSeed = useRef(Date.now());
  const isDiscover = section === 'discover';
  const posts = isDiscover ? discoverPosts : followingPosts;
  const page = isDiscover ? discoverPage : followingPage;
  const hasMore = isDiscover ? discoverHasMore : followingHasMore;

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
  }, []);

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
      return;
    }
    async function loadSuggestions() {
      try {
        const data = await getTagSuggestions(query);
        if (isMounted) {
          setTagSuggestions(data);
        }
      } catch {
        if (isMounted) {
          setTagSuggestions([]);
        }
      }
    }
    void loadSuggestions();
    return () => {
      isMounted = false;
    };
  }, [tagQuery, selectedTag]);

  useEffect(() => {
    if (section === 'following' && session?.accessToken && followingPage === 0) {
      void loadFollowingPage(1, session.accessToken, true);
    }
  }, [section, session, followingPage]);

  async function loadDiscoverPage(nextPage: number, replace = false, tagName = selectedTag) {
    setContentMessage('');
    const data = await getDiscoverPosts(nextPage, PAGE_SIZE, discoverSeed.current, tagName);
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

  function renderFooter() {
    if (isInitialLoading && posts.length === 0) {
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

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.segmentedControl}>
        <Pressable
          style={[styles.segmentButton, isDiscover && styles.segmentButtonActive]}
          onPress={() => switchSection('discover')}
        >
          <Text style={[styles.segmentText, isDiscover && styles.segmentTextActive]}>发现</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentButton, !isDiscover && styles.segmentButtonActive]}
          onPress={() => switchSection('following')}
        >
          <Text style={[styles.segmentText, !isDiscover && styles.segmentTextActive]}>关注</Text>
        </Pressable>
      </View>

      <FlatList
        key={section}
        contentContainerStyle={styles.pageContent}
        data={posts}
        renderItem={({ item }) => (
          <PostCard post={item} showAuthor showStats onPress={() => onOpenPost(item.id)} onOpenTag={selectTag} />
        )}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          isDiscover ? (
            <>
              <Text style={styles.logo}>博客小站</Text>
              {selectedTag ? (
                <View style={styles.selectedTagRow}>
                  <Text style={styles.selectedTagText}>#{selectedTag}</Text>
                  <Pressable onPress={clearTag}>
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
                    onChangeText={setTagQuery}
                  />
                  {tagSuggestions.length > 0 && (
                    <View style={styles.suggestionPanel}>
                      {tagSuggestions.map((tag) => (
                        <Pressable key={tag} style={styles.suggestionItem} onPress={() => selectTag(tag)}>
                          <Text style={styles.suggestionText}>#{tag}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
              <Text style={styles.sectionTitle}>{selectedTag ? '标签博客' : '今日推荐'}</Text>
            </>
          ) : null
        }
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        refreshing={isRefreshing}
        onRefresh={refresh}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function appendUniquePosts(currentPosts: Post[], incomingPosts: Post[]) {
  const existingIds = new Set(currentPosts.map((post) => post.id));
  return [...currentPosts, ...incomingPosts.filter((post) => !existingIds.has(post.id))];
}
