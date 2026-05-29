import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { CollectionCard } from '../components/CollectionCard';
import { PostCard } from '../components/PostCard';
import { styles } from '../components/styles';
import type { AuthSession } from '../services/authSession';
import { useAuthStore } from '../stores/authStore';
import {
  getCollectionDetail,
  addPostToCollection,
  createCollection,
  deleteCollection,
  getMyCollections,
  getMyFavorites,
  getMyFollowing,
  getMyPosts,
  getPostDetail,
  removePostFromCollection,
  setCollectionFavorited,
  updateCollection,
  type FollowingUser,
  type ProfileFavorite,
  type ProfileCollection,
  type ProfilePost,
} from '../services/profileApi';

type ProfileTab = 'posts' | 'favorites' | 'collections' | 'following';

type ProfileScreenProps = {
  onOpenAuth: () => void;
  onOpenPost: (postId: number) => void;
  onOpenAuthor: (authorId: number) => void;
  onOpenTag: (tag: string) => void;
};

export function ProfileScreen({ onOpenAuth, onOpenPost, onOpenAuthor, onOpenTag }: ProfileScreenProps) {
  const session = useAuthStore((state) => state.session);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const refreshAuth = useAuthStore((state) => state.refresh);
  const hasLoaded = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (hasLoaded.current) {
        return;
      }
      hasLoaded.current = true;

      async function loadProfile() {
        if (isMounted) {
          await refreshAuth();
        }
      }

      void loadProfile();

      return () => {
        isMounted = false;
      };
    }, [refreshAuth])
  );

  if (isAuthLoading) {
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
      onOpenAuthor={onOpenAuthor}
      onOpenTag={onOpenTag}
    />
  );
}

type LoggedInProfileProps = {
  session: AuthSession;
  onOpenPost: (postId: number) => void;
  onOpenAuthor: (authorId: number) => void;
  onOpenTag: (tag: string) => void;
};

function LoggedInProfile({ session, onOpenPost, onOpenAuthor, onOpenTag }: LoggedInProfileProps) {
  const logoutAuth = useAuthStore((state) => state.logout);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [favorites, setFavorites] = useState<ProfileFavorite[]>([]);
  const [collections, setCollections] = useState<ProfileCollection[]>([]);
  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<ProfileCollection | null>(null);
  const [collectionPosts, setCollectionPosts] = useState<ProfilePost[]>([]);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [contentMessage, setContentMessage] = useState('');
  const [collectionTitle, setCollectionTitle] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [editingCollection, setEditingCollection] = useState<ProfileCollection | null>(null);
  const [isCollectionFormOpen, setIsCollectionFormOpen] = useState(false);
  const [movingPost, setMovingPost] = useState<ProfilePost | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadContent() {
        setIsContentLoading(true);
        setContentMessage('');
        setSelectedCollection(null);
        setCollectionPosts([]);

        try {
          const [postsData, favoritesData, collectionsData, followingData] = await Promise.all([
            getMyPosts(session.accessToken),
            getMyFavorites(session.accessToken),
            getMyCollections(session.accessToken),
            getMyFollowing(session.accessToken),
          ]);
          if (isMounted) {
            setPosts(postsData.items);
            setFavorites(favoritesData.items);
            setCollections(collectionsData.items);
            setFollowing(followingData.items);
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
    await logoutAuth();
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
    setMovingPost(null);
    resetCollectionForm();
    setActiveTab(tab);
  }

  function resetCollectionForm() {
    setCollectionTitle('');
    setCollectionDescription('');
    setEditingCollection(null);
    setIsCollectionFormOpen(false);
  }

  async function submitCollection() {
    const title = collectionTitle.trim();
    if (!title) {
      setContentMessage('请先为合集取名。');
      return;
    }
    setIsContentLoading(true);
    setContentMessage('');
    try {
      if (editingCollection) {
        await updateCollection(editingCollection.id, title, collectionDescription.trim(), session.accessToken);
        setCollections((current) => current.map((collection) => collection.id === editingCollection.id ? { ...collection, title, description: collectionDescription.trim() || null } : collection));
        if (selectedCollection?.id === editingCollection.id) {
          setSelectedCollection({ ...selectedCollection, title, description: collectionDescription.trim() || null });
        }
      } else {
        const created = await createCollection(title, collectionDescription.trim(), session.accessToken);
        setCollections((current) => [{ ...created, description: collectionDescription.trim() || null, item_count: 0 }, ...current]);
      }
      resetCollectionForm();
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : '合集保存失败。');
    } finally {
      setIsContentLoading(false);
    }
  }

  function startEditCollection(collection: ProfileCollection) {
    setEditingCollection(collection);
    setCollectionTitle(collection.title);
    setCollectionDescription(collection.description || '');
    setIsCollectionFormOpen(true);
    setActiveTab('collections');
  }

  function confirmDeleteCollection(collection: ProfileCollection) {
    const confirm = typeof globalThis.confirm === 'function'
      ? globalThis.confirm('删除合集文件夹？其中的文章不会被删除。')
      : true;
    if (confirm) {
      void handleDeleteCollection(collection);
    }
  }

  async function handleDeleteCollection(collection: ProfileCollection) {
    setIsContentLoading(true);
    setContentMessage('');
    try {
      await deleteCollection(collection.id, session.accessToken);
      setCollections((current) => current.filter((item) => item.id !== collection.id));
      setFavorites((current) => current.filter((item) => !isCollectionFavorite(item) || item.id !== collection.id));
      if (selectedCollection?.id === collection.id) {
        setSelectedCollection(null);
        setCollectionPosts([]);
      }
      if (editingCollection?.id === collection.id) {
        resetCollectionForm();
      }
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : '合集删除失败。');
    } finally {
      setIsContentLoading(false);
    }
  }

  async function movePostToCollection(collection: ProfileCollection) {
    if (!movingPost) return;
    setIsContentLoading(true);
    setContentMessage('');
    try {
      await addPostToCollection(collection.id, movingPost.id, session.accessToken);
      setCollections((current) => current.map((item) => item.id === collection.id ? { ...item, item_count: (item.item_count ?? 0) + 1 } : item));
      setMovingPost(null);
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : '移入合集失败。');
    } finally {
      setIsContentLoading(false);
    }
  }

  async function removeCurrentCollectionPost(post: ProfilePost) {
    if (!selectedCollection) return;
    setIsContentLoading(true);
    setContentMessage('');
    try {
      await removePostFromCollection(selectedCollection.id, post.id, session.accessToken);
      setCollectionPosts((current) => current.filter((item) => item.id !== post.id));
      setCollections((current) => current.map((item) => item.id === selectedCollection.id ? { ...item, item_count: Math.max(0, (item.item_count ?? 0) - 1) } : item));
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : '移出合集失败。');
    } finally {
      setIsContentLoading(false);
    }
  }

  async function toggleCollectionFavorite(collection: ProfileCollection) {
    const nextFavorited = !collection.is_favorited;
    setContentMessage('');
    try {
      await setCollectionFavorited(collection.id, nextFavorited, session.accessToken);
      setCollections((current) => current.map((item) => item.id === collection.id ? { ...item, is_favorited: nextFavorited } : item));
      setFavorites((current) => nextFavorited ? [{ ...collection, is_favorited: true, favorite_type: 'collection' }, ...current] : current.filter((item) => !isCollectionFavorite(item) || item.id !== collection.id));
      if (selectedCollection?.id === collection.id) {
        setSelectedCollection({ ...selectedCollection, is_favorited: nextFavorited });
      }
    } catch (error) {
      setContentMessage(error instanceof Error ? error.message : '合集收藏失败。');
    }
  }

  const sectionTitle = selectedCollection
    ? selectedCollection.title
    : activeTab === 'posts'
      ? '我的发布'
      : activeTab === 'favorites'
        ? '我的收藏'
        : activeTab === 'following'
          ? '我的关注'
          : '我的合集';

  const avatarText = session.user.display_name.slice(0, 1) || session.user.username.slice(0, 1) || '我';

  const currentData: (ProfilePost | ProfileCollection | FollowingUser | ProfileFavorite)[] = selectedCollection
    ? collectionPosts
    : activeTab === 'collections'
      ? collections
      : activeTab === 'following'
        ? following
      : activeTab === 'favorites'
        ? favorites
        : posts;

  const collectionForm = activeTab === 'collections' && !selectedCollection ? (
    <View style={styles.authPromptCard}>
      {!isCollectionFormOpen ? (
        <Pressable style={[styles.actionButton, styles.actionButtonActive]} onPress={() => setIsCollectionFormOpen(true)}>
          <Text style={styles.actionButtonText}>创建合集</Text>
        </Pressable>
      ) : (
        <>
          <Text style={styles.authPromptTitle}>{editingCollection ? '编辑合集' : '创建合集'}</Text>
          <TextInput
            style={styles.input}
            placeholder="合集名称"
            placeholderTextColor="#a89994"
            value={collectionTitle}
            onChangeText={setCollectionTitle}
          />
          <TextInput
            style={[styles.input, { minHeight: 90 }]}
            multiline
            placeholder="添加描述，让读者知道这个文件夹的主题"
            placeholderTextColor="#a89994"
            value={collectionDescription}
            onChangeText={setCollectionDescription}
          />
          <View style={styles.actionRow}>
            <Pressable style={styles.actionButton} onPress={resetCollectionForm}>
              <Text style={styles.actionButtonText}>取消</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.actionButtonActive]} onPress={submitCollection}>
              <Text style={styles.actionButtonText}>{editingCollection ? '保存合集' : '创建合集'}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  ) : null;

  const movePanel = movingPost ? (
    <View style={styles.authPromptCard}>
      <Text style={styles.authPromptTitle}>将《{movingPost.title}》移入合集</Text>
      {collections.length ? collections.map((collection) => (
        <Pressable key={collection.id} style={styles.compactActionButton} onPress={() => movePostToCollection(collection)}>
          <Text style={styles.compactActionText}>{collection.title}</Text>
        </Pressable>
      )) : <Text style={styles.profileBio}>还没有合集，先创建一个合集。</Text>}
      <Pressable style={styles.backButton} onPress={() => setMovingPost(null)}>
        <Text style={styles.backButtonText}>取消移动</Text>
      </Pressable>
    </View>
  ) : null;

  const header = (
    <>
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
        <Pressable style={styles.profileStatItem} onPress={() => selectTab('following')}>
          <Text style={styles.profileStatNumber}>{following.length}</Text>
          <Text style={[styles.profileStatLabel, activeTab === 'following' && styles.segmentTextActive]}>关注</Text>
        </Pressable>
      </View>

      {selectedCollection && (
        <Pressable style={styles.backButton} onPress={() => setSelectedCollection(null)}>
          <Text style={styles.backButtonText}>‹ 返回合集</Text>
        </Pressable>
      )}
      {selectedCollection?.description ? <Text style={styles.profileBio}>{selectedCollection.description}</Text> : null}
      {collectionForm}
      {movePanel}
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
    </>
  );

  const footer = () => {
    if (isContentLoading) {
      return <Text style={[styles.profileBio, { padding: 16, textAlign: 'center' }]}>正在加载内容...</Text>;
    }
    if (contentMessage) {
      return <Text style={[styles.authApiHint, { color: '#a05d6f', textAlign: 'center', padding: 16 }]}>{contentMessage}</Text>;
    }
    return null;
  };

  const renderItem = ({ item }: { item: ProfilePost | ProfileCollection | FollowingUser | ProfileFavorite }) => {
    if (activeTab === 'collections' && !selectedCollection) {
      const collection = item as ProfileCollection;
      return <CollectionCard key={collection.id} collection={collection} onPress={() => openCollection(collection)} actions={[
        { label: '编辑', onPress: () => startEditCollection(collection) },
        { label: '删除', onPress: () => confirmDeleteCollection(collection), danger: true },
      ]} />;
    }
    if (activeTab === 'favorites' && !selectedCollection && isCollectionFavorite(item)) {
      const collection = item as ProfileCollection;
      return <CollectionCard key={`collection-${collection.id}`} collection={collection} tone="favorite" onPress={() => openCollection(collection)} actions={[
        { label: '取消收藏', onPress: () => toggleCollectionFavorite(collection) },
      ]} />;
    }
    if (activeTab === 'following' && !selectedCollection) {
      const user = item as FollowingUser;
      const avatarText = user.display_name.slice(0, 1) || user.username.slice(0, 1) || '关';
      return (
        <Pressable style={styles.card} onPress={() => onOpenAuthor(user.id)}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarMuted}>
              <Text style={styles.avatarText}>{avatarText}</Text>
            </View>
            <View>
              <Text style={styles.cardTitle}>{user.display_name}</Text>
              <Text style={styles.profileBio}>@{user.username}</Text>
              {user.bio ? <Text style={styles.cardSummary}>{user.bio}</Text> : null}
            </View>
          </View>
        </Pressable>
      );
    }
    const showAuthor = !selectedCollection && activeTab === 'favorites';
    const post = item as ProfilePost;
    return (
      <View>
        <PostCard key={post.id} post={post} showAuthor={showAuthor} showStats onPress={() => onOpenPost(post.id)} onOpenTag={onOpenTag} />
        {activeTab === 'posts' && !selectedCollection ? (
          <View style={[styles.compactActionRow, { marginTop: -8, marginBottom: 14 }]}>
            <Pressable style={styles.compactActionButton} onPress={() => setMovingPost(post)}>
              <Text style={styles.compactActionText}>添加到合集</Text>
            </Pressable>
          </View>
        ) : null}
        {selectedCollection ? (
          <View style={[styles.compactActionRow, { marginTop: -8, marginBottom: 14 }]}>
            <Pressable style={[styles.compactActionButton, styles.compactDangerButton]} onPress={() => removeCurrentCollectionPost(post)}>
              <Text style={[styles.compactActionText, styles.compactDangerText]}>移出合集</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <FlatList
      contentContainerStyle={styles.pageContent}
      data={currentData}
      renderItem={renderItem}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={!isContentLoading && !contentMessage ? <Text style={[styles.profileBio, { textAlign: 'center', padding: 16 }]}>暂无内容</Text> : null}
      showsVerticalScrollIndicator={false}
    />
  );
}

function isCollectionFavorite(item: ProfilePost | ProfileCollection | FollowingUser | ProfileFavorite): item is ProfileCollection {
  return 'favorite_type' in item && item.favorite_type === 'collection';
}
