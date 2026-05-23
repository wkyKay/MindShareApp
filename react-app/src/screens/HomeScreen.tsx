import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { PostCard } from '../components/PostCard';
import { styles } from '../components/styles';
import type { AuthSession } from '../services/authSession';
import { getDiscoverPosts, getFollowingPosts, type Post } from '../services/homeApi';

type HomeScreenProps = {
  onOpenPost: (postId: number) => void;
  session: AuthSession | null;
};

const PAGE_SIZE = 10;

export function HomeScreen({ onOpenPost, session }: HomeScreenProps) {
  const [section, setSection] = useState<'discover' | 'following'>('discover');
  const [discoverPosts, setDiscoverPosts] = useState<Post[]>([]);
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [discoverPage, setDiscoverPage] = useState(0);
  const [followingPage, setFollowingPage] = useState(0);
  const [discoverHasMore, setDiscoverHasMore] = useState(true);
  const [followingHasMore, setFollowingHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [contentMessage, setContentMessage] = useState('');

  const discoverSeed = useRef(Date.now());
  const isDiscover = section === 'discover';
  const posts = isDiscover ? discoverPosts : followingPosts;
  const page = isDiscover ? discoverPage : followingPage;
  const hasMore = isDiscover ? discoverHasMore : followingHasMore;

  useEffect(() => {
    void loadDiscoverPage(1, true);
  }, []);

  useEffect(() => {
    if (section === 'following' && session?.accessToken && followingPage === 0) {
      void loadFollowingPage(1, session.accessToken, true);
    }
  }, [section, session, followingPage]);

  async function loadDiscoverPage(nextPage: number, replace = false) {
    setContentMessage('');
    const data = await getDiscoverPosts(nextPage, PAGE_SIZE, discoverSeed.current);
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
        await loadDiscoverPage(1, true);
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
  }

  function renderFooter() {
    if (isLoadingMore) {
      return <ActivityIndicator style={{ padding: 16 }} />;
    }
    if (contentMessage) {
      return <Text style={[styles.authApiHint, { color: '#a05d6f', padding: 16 }]}>{contentMessage}</Text>;
    }
    if (posts.length === 0) {
      return (
        <Text style={[styles.authApiHint, { padding: 16 }]}>
          {isDiscover ? '暂无推荐博客。' : '关注功能尚未开放，当前没有关注动态。'}
        </Text>
      );
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

      {!isDiscover ? (
        <View style={{ flex: 1 }} />
      ) : (
        <FlatList
          key={section}
          contentContainerStyle={styles.pageContent}
          data={posts}
          renderItem={({ item }) => (
            <PostCard post={item} showAuthor showStats onPress={() => onOpenPost(item.id)} />
          )}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <>
              <Text style={styles.logo}>博客小站</Text>
              <TextInput style={styles.searchInput} placeholder="搜索作品、作者、合集" placeholderTextColor="#9a8f8a" />
              <Text style={styles.sectionTitle}>{isDiscover ? '今日推荐' : '关注更新'}</Text>
            </>
          }
          ListFooterComponent={renderFooter}
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          refreshing={isRefreshing}
          onRefresh={refresh}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function appendUniquePosts(currentPosts: Post[], incomingPosts: Post[]) {
  const existingIds = new Set(currentPosts.map((post) => post.id));
  return [...currentPosts, ...incomingPosts.filter((post) => !existingIds.has(post.id))];
}
