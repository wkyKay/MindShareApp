import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { styles } from '../components/styles';
import { getMyCollections, getMyFavorites, getMyPosts, type FavoritePost, type ProfileFavorite, type ProfilePost } from '../services/profileApi';
import { useAuthStore } from '../stores/authStore';

type ProfileAnalyticsScreenProps = {
  onBack: () => void;
  onOpenAuth: () => void;
  onOpenPost: (postId: number) => void;
};

type TagCount = {
  tag: string;
  count: number;
};

function isFavoritePost(item: ProfileFavorite): item is FavoritePost {
  return 'tags' in item;
}

function buildTagCounts(posts: ProfilePost[]) {
  const counts = new Map<string, number>();
  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 8);
}

function AnalyticsBarList({ title, emptyText, data }: { title: string; emptyText: string; data: TagCount[] }) {
  const maxCount = data[0]?.count || 0;

  return (
    <View style={styles.analyticsCard}>
      <Text style={styles.analyticsCardTitle}>{title}</Text>
      {data.length === 0 ? (
        <Text style={styles.analyticsEmptyText}>{emptyText}</Text>
      ) : (
        data.map((item) => {
          const width: DimensionValue = maxCount > 0 ? `${Math.max(12, Math.round((item.count / maxCount) * 100))}%` : '0%';
          return (
            <View key={item.tag} style={styles.analyticsBarItem}>
              <View style={styles.analyticsBarLabelRow}>
                <Text style={styles.analyticsTagText}>#{item.tag}</Text>
                <Text style={styles.analyticsCountText}>{item.count}</Text>
              </View>
              <View style={styles.analyticsBarTrack}>
                <View style={[styles.analyticsBarFill, { width }]} />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

function AnalyticsMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.analyticsMetricItem}>
      <Text style={styles.analyticsMetricValue}>{value}</Text>
      <Text style={styles.analyticsMetricLabel}>{label}</Text>
    </View>
  );
}

export function ProfileAnalyticsScreen({ onBack, onOpenAuth, onOpenPost }: ProfileAnalyticsScreenProps) {
  const session = useAuthStore((state) => state.session);
  const requireAuthSession = useAuthStore((state) => state.requireSession);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [favorites, setFavorites] = useState<ProfileFavorite[]>([]);
  const [collectionsCount, setCollectionsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadAnalytics() {
        setIsLoading(true);
        setMessage('');
        const activeSession = session ?? (await requireAuthSession());
        if (!activeSession) {
          if (isMounted) {
            setIsLoading(false);
            setMessage('请先登录后查看资料分析。');
          }
          return;
        }

        try {
          const [postsData, favoritesData, collectionsData] = await Promise.all([
            getMyPosts(activeSession.accessToken),
            getMyFavorites(activeSession.accessToken),
            getMyCollections(activeSession.accessToken),
          ]);
          if (isMounted) {
            setPosts(postsData.items);
            setFavorites(favoritesData.items);
            setCollectionsCount(collectionsData.items.length);
          }
        } catch (error) {
          if (isMounted) {
            setMessage(error instanceof Error ? error.message : '资料分析加载失败，请稍后重试。');
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }

      void loadAnalytics();

      return () => {
        isMounted = false;
      };
    }, [requireAuthSession, session])
  );

  const favoritePosts = favorites.filter(isFavoritePost);
  const authoredTags = buildTagCounts(posts.filter((post) => post.status !== 'deleted'));
  const favoritedTags = buildTagCounts(favoritePosts);
  const totalLikes = posts.reduce((sum, post) => sum + post.like_count, 0);
  const totalComments = posts.reduce((sum, post) => sum + post.comment_count, 0);
  const totalFavorites = posts.reduce((sum, post) => sum + post.favorite_count, 0);
  const draftCount = posts.filter((post) => post.status === 'draft').length;
  const topPosts = [...posts]
    .filter((post) => post.status !== 'deleted')
    .sort((a, b) => (b.like_count + b.comment_count + b.favorite_count) - (a.like_count + a.comment_count + a.favorite_count))
    .slice(0, 3);
  const authoredTopTag = authoredTags[0]?.tag || '暂无';
  const favoritedTopTag = favoritedTags[0]?.tag || '暂无';

  return (
    <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
      <View style={styles.pageHeaderRow}>
        <Pressable style={styles.backButtonCompact} onPress={onBack}>
          <Text style={styles.backButtonText}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.pageTitle}>资料分析</Text>
      </View>

      {!session && !isLoading ? (
        <Pressable style={styles.primaryButton} onPress={onOpenAuth}>
          <Text style={styles.primaryButtonText}>去登录</Text>
        </Pressable>
      ) : null}

      {isLoading ? <Text style={styles.profileBio}>正在生成你的内容画像...</Text> : null}
      {!!message ? <Text style={[styles.authApiHint, { color: '#a05d6f' }]}>{message}</Text> : null}

      <View style={styles.analyticsMetricGrid}>
        <AnalyticsMetric label="发布" value={posts.length} />
        <AnalyticsMetric label="草稿" value={draftCount} />
        <AnalyticsMetric label="收藏文章" value={favoritePosts.length} />
        <AnalyticsMetric label="合集" value={collectionsCount} />
      </View>

      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsCardTitle}>互动总览</Text>
        <View style={styles.analyticsMetricGridCompact}>
          <AnalyticsMetric label="获赞" value={totalLikes} />
          <AnalyticsMetric label="评论" value={totalComments} />
          <AnalyticsMetric label="被收藏" value={totalFavorites} />
        </View>
      </View>

      <AnalyticsBarList title="我的发布 Tag 分布" emptyText="发布内容还没有标签。" data={authoredTags} />
      <AnalyticsBarList title="我的收藏 Tag 分布" emptyText="收藏文章还没有标签。" data={favoritedTags} />

      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsCardTitle}>创作与收藏偏好</Text>
        <Text style={styles.analyticsInsightText}>你最常发布：#{authoredTopTag}</Text>
        <Text style={styles.analyticsInsightText}>你最常收藏：#{favoritedTopTag}</Text>
      </View>

      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsCardTitle}>表现较好的内容</Text>
        {topPosts.length === 0 ? (
          <Text style={styles.analyticsEmptyText}>还没有可分析的发布内容。</Text>
        ) : (
          topPosts.map((post) => (
            <Pressable key={post.id} style={styles.analyticsTopPostItem} onPress={() => onOpenPost(post.id)}>
              <Text style={styles.analyticsTopPostTitle}>{post.title}</Text>
              <Text style={styles.analyticsCountText}>赞 {post.like_count} · 评论 {post.comment_count} · 收藏 {post.favorite_count}</Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}
