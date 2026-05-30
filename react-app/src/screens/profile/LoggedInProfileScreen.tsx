import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { CollectionCard } from '../../components/CollectionCard';
import { PostCard } from '../../components/PostCard';
import { styles } from '../../components/styles';
import type { AuthSession } from '../../services/authSession';
import {
  addPostToCollection,
  createCollection,
  deleteCollection,
  getCollectionDetail,
  getMyCollections,
  getMyFavorites,
  getMyFollowing,
  getMyPosts,
  getPostDetail,
  removePostFromCollection,
  setCollectionFavorited,
  updateCollection,
  type FollowingUser,
  type ProfileCollection,
  type ProfileFavorite,
  type ProfilePost,
} from '../../services/profileApi';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { CollectionForm } from './CollectionForm';
import { MovePostPanel } from './MovePostPanel';
import { ProfileStats, type ProfileTab } from './ProfileStats';
import { CollectionsTabItem } from './tabs/CollectionsTab';
import { FollowingTabItem } from './tabs/FollowingTab';

type LoggedInProfileScreenProps = {
  session: AuthSession;
  onOpenPost: (postId: number) => void;
  onOpenAuthor: (authorId: number) => void;
  onOpenTag: (tag: string) => void;
};

export function LoggedInProfileScreen({ session, onOpenPost, onOpenAuthor, onOpenTag }: LoggedInProfileScreenProps) {
  const logoutAuth = useAuthStore((state) => state.logout);
  const unreadByPostId = useNotificationStore((state) => state.unreadByPostId);
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

  async function openCollection(collection: ProfileCollection) {
    setIsContentLoading(true);
    setContentMessage('');
    setSelectedCollection(collection);
    setCollectionPosts([]);

    try {
      const detail = await getCollectionDetail(collection.id, session.accessToken);
      const detailPosts = await Promise.all(detail.items.map((item) => getPostDetail(item.post_id, session.accessToken)));
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
    const confirm = typeof globalThis.confirm === 'function' ? globalThis.confirm('删除合集文件夹？其中的文章不会被删除。') : true;
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
  const postsBadgeCount = posts.reduce((count, post) => count + (unreadByPostId[post.id] || 0), 0);

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
    <CollectionForm
      isOpen={isCollectionFormOpen}
      editingCollection={editingCollection}
      title={collectionTitle}
      description={collectionDescription}
      onOpen={() => setIsCollectionFormOpen(true)}
      onChangeTitle={setCollectionTitle}
      onChangeDescription={setCollectionDescription}
      onCancel={resetCollectionForm}
      onSubmit={submitCollection}
    />
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

      <Pressable style={styles.backButton} onPress={logoutAuth}>
        <Text style={styles.backButtonText}>退出登录</Text>
      </Pressable>

      <ProfileStats
        activeTab={activeTab}
        postsCount={posts.length}
        favoritesCount={favorites.length}
        collectionsCount={collections.length}
        followingCount={following.length}
        postsBadgeCount={postsBadgeCount}
        onSelectTab={selectTab}
      />

      {selectedCollection && (
        <Pressable style={styles.backButton} onPress={() => setSelectedCollection(null)}>
          <Text style={styles.backButtonText}>‹ 返回合集</Text>
        </Pressable>
      )}
      {selectedCollection?.description ? <Text style={styles.profileBio}>{selectedCollection.description}</Text> : null}
      {collectionForm}
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
      return <CollectionsTabItem collection={collection} onOpen={openCollection} onEdit={startEditCollection} onDelete={confirmDeleteCollection} />;
    }
    if (activeTab === 'favorites' && !selectedCollection && isCollectionFavorite(item)) {
      const collection = item as ProfileCollection;
      return <CollectionCard key={`collection-${collection.id}`} collection={collection} tone="favorite" onPress={() => openCollection(collection)} actions={[
        { label: '取消收藏', onPress: () => toggleCollectionFavorite(collection) },
      ]} />;
    }
    if (activeTab === 'following' && !selectedCollection) {
      return <FollowingTabItem user={item as FollowingUser} onOpenAuthor={onOpenAuthor} />;
    }
    const showAuthor = !selectedCollection && activeTab === 'favorites';
    const post = item as ProfilePost;
    const hasCommentNotification = (unreadByPostId[post.id] || 0) > 0;
    return (
      <View>
        <PostCard
          key={post.id}
          post={post}
          showAuthor={showAuthor}
          showStats
          hasCommentNotification={activeTab === 'posts' && !selectedCollection && hasCommentNotification}
          onPress={() => onOpenPost(post.id)}
          onOpenTag={onOpenTag}
        />
        {activeTab === 'posts' && !selectedCollection ? (
          <MovePostPanel
            post={post}
            collections={collections}
            isOpen={movingPost?.id === post.id}
            onOpen={() => setMovingPost(post)}
            onMoveToCollection={movePostToCollection}
            onCancel={() => setMovingPost(null)}
          />
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
