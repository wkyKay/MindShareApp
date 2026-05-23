import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { CollectionCard } from '../components/CollectionCard';
import { PostCard } from '../components/PostCard';
import { styles } from '../components/styles';
import { clearAuthSession, refreshAuthSession, type AuthSession } from '../services/authSession';
import {
  getCollectionDetail,
  getMyCollections,
  getMyFavorites,
  getMyPosts,
  getPostDetail,
  type ProfileCollection,
  type ProfilePost,
} from '../services/profileApi';

type ProfileTab = 'posts' | 'favorites' | 'collections';

type ProfileScreenProps = {
  initialSession: AuthSession | null;
  onOpenAuth: () => void;
  onOpenPost: (postId: number) => void;
  onSessionChange: (session: AuthSession | null) => void;
};

export function ProfileScreen({ initialSession, onOpenAuth, onOpenPost, onSessionChange }: ProfileScreenProps) {
  const [session, setSession] = useState<AuthSession | null>(initialSession);
  const [isLoading, setIsLoading] = useState(true);
  const initialRef = useRef(initialSession);
  const onChangeRef = useRef(onSessionChange);
  initialRef.current = initialSession;
  onChangeRef.current = onSessionChange;
  const hasLoaded = useRef(false);

  useEffect(() => {
    setSession(initialSession);
    if (initialSession) {
      setIsLoading(false);
      hasLoaded.current = false;
    }
  }, [initialSession]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (hasLoaded.current) {
        setIsLoading(false);
        return;
      }
      hasLoaded.current = true;

      async function loadProfile() {
        if (initialRef.current && isMounted) {
          setSession(initialRef.current);
          setIsLoading(false);
        }

        try {
          const refreshedSession = await refreshAuthSession();
          if (isMounted && refreshedSession) {
            setSession(refreshedSession);
            onChangeRef.current(refreshedSession);
          }
        } catch {
          await clearAuthSession();
          if (isMounted) {
            setSession(null);
            onChangeRef.current(null);
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }

      void loadProfile();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.pageContent}>
        <Text style={styles.pageTitle}>我的主页</Text>
        <Text style={styles.profileBio}>正在加载账号信息...</Text>
      </ScrollView>
    );
  }

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarMuted}>
            <Text style={styles.avatarText}>访</Text>
          </View>
          <View>
            <Text style={styles.pageTitle}>我的主页</Text>
            <Text style={styles.profileBio}>登录后管理发布、收藏与合集</Text>
          </View>
        </View>

        <View style={styles.authPromptCard}>
          <Text style={styles.authPromptTitle}>进入创作者空间</Text>
          <Text style={styles.authPromptText}>注册账号后即可发布同人作品、创建合集，并收藏喜欢的文章。</Text>
          <Pressable style={styles.primaryButton} onPress={onOpenAuth}>
            <Text style={styles.primaryButtonText}>登录 / 注册</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <LoggedInProfile
      session={session}
      onOpenPost={onOpenPost}
      onLoggedOut={() => {
        setSession(null);
        onSessionChange(null);
      }}
    />
  );
}

type LoggedInProfileProps = {
  session: AuthSession;
  onOpenPost: (postId: number) => void;
  onLoggedOut: () => void;
};

function LoggedInProfile({ session, onOpenPost, onLoggedOut }: LoggedInProfileProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [favorites, setFavorites] = useState<ProfilePost[]>([]);
  const [collections, setCollections] = useState<ProfileCollection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<ProfileCollection | null>(null);
  const [collectionPosts, setCollectionPosts] = useState<ProfilePost[]>([]);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [contentMessage, setContentMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadContent() {
        setIsContentLoading(true);
        setContentMessage('');
        setSelectedCollection(null);
        setCollectionPosts([]);

        try {
          const [postsData, favoritesData, collectionsData] = await Promise.all([
            getMyPosts(session.accessToken),
            getMyFavorites(session.accessToken),
            getMyCollections(session.accessToken),
          ]);
          if (isMounted) {
            setPosts(postsData.items);
            setFavorites(favoritesData.items);
            setCollections(collectionsData.items);
          }
        } catch (error) {
          if (isMounted) {
            setContentMessage(error instanceof Error ? error.message : '内容加载失败，请稍后重试。');
          }
        } finally {
          if (isMounted) {
            setIsContentLoading(false);
          }
        }
      }

      void loadContent();

      return () => {
        isMounted = false;
      };
    }, [session.accessToken])
  );

  async function logout() {
    await clearAuthSession();
    onLoggedOut();
  }

  async function openCollection(collection: ProfileCollection) {
    setIsContentLoading(true);
    setContentMessage('');
    setSelectedCollection(collection);
    setCollectionPosts([]);

    try {
      const detail = await getCollectionDetail(collection.id, session.accessToken);
      const detailPosts = await Promise.all(
        detail.items.map((item) => getPostDetail(item.post_id, session.accessToken))
      );
      setSelectedCollection(detail);
      setCollectionPosts(detailPosts);
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : '合集加载失败，请稍后重试。');
    } finally {
      setIsContentLoading(false);
    }
  }

  function selectTab(tab: ProfileTab) {
    setSelectedCollection(null);
    setCollectionPosts([]);
    setActiveTab(tab);
  }

  function renderContent() {
    if (isContentLoading) {
      return <Text style={styles.profileBio}>正在加载内容...</Text>;
    }
    if (contentMessage) {
      return <Text style={[styles.authApiHint, { color: '#a05d6f' }]}>{contentMessage}</Text>;
    }
    if (selectedCollection) {
      return collectionPosts.map((post) => <PostCard key={post.id} post={post} showAuthor showStats onPress={() => onOpenPost(post.id)} />);
    }
    if (activeTab === 'posts') {
      return posts.map((post) => <PostCard key={post.id} post={post} showStats onPress={() => onOpenPost(post.id)} />);
    }
    if (activeTab === 'favorites') {
      return favorites.map((post) => <PostCard key={post.id} post={post} showAuthor showStats onPress={() => onOpenPost(post.id)} />);
    }
    return collections.map((collection) => (
      <CollectionCard key={collection.id} collection={collection} onPress={() => openCollection(collection)} />
    ));
  }

  const avatarText = session.user.display_name.slice(0, 1) || session.user.username.slice(0, 1) || '我';
  const sectionTitle = selectedCollection
    ? selectedCollection.title
    : activeTab === 'posts'
      ? '我的发布'
      : activeTab === 'favorites'
        ? '我的收藏'
        : '我的合集';

  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarText}</Text>
        </View>
        <View>
          <Text style={styles.pageTitle}>{session.user.display_name}</Text>
          <Text style={styles.profileBio}>{session.user.bio || `@${session.user.username} · ${session.user.email}`}</Text>
        </View>
      </View>

      <Pressable style={styles.backButton} onPress={logout}>
        <Text style={styles.backButtonText}>退出登录</Text>
      </Pressable>

      <View style={styles.profileStats}>
        <Pressable style={styles.profileStatItem} onPress={() => selectTab('posts')}>
          <Text style={styles.profileStatNumber}>{posts.length}</Text>
          <Text style={[styles.profileStatLabel, activeTab === 'posts' && styles.segmentTextActive]}>发布</Text>
        </Pressable>
        <Pressable style={styles.profileStatItem} onPress={() => selectTab('favorites')}>
          <Text style={styles.profileStatNumber}>{favorites.length}</Text>
          <Text style={[styles.profileStatLabel, activeTab === 'favorites' && styles.segmentTextActive]}>收藏</Text>
        </Pressable>
        <Pressable style={styles.profileStatItem} onPress={() => selectTab('collections')}>
          <Text style={styles.profileStatNumber}>{collections.length}</Text>
          <Text style={[styles.profileStatLabel, activeTab === 'collections' && styles.segmentTextActive]}>合集</Text>
        </Pressable>
      </View>

      {selectedCollection && (
        <Pressable style={styles.backButton} onPress={() => setSelectedCollection(null)}>
          <Text style={styles.backButtonText}>‹ 返回合集</Text>
        </Pressable>
      )}
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
      {renderContent()}
    </ScrollView>
  );
}
