import { useState } from "react";
import { FlatList, Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { CollectionCard } from "../../components/CollectionCard";
import { ProfileScreenSkeleton } from "../../components/Skeleton";
import { useDelayedLoading } from "../../hooks/useDelayedLoading";
import type { AuthSession } from "../../services/authSession";
import {
  type FollowingUser,
  type ProfileCollection,
  type ProfileFavorite,
  type ProfilePost,
} from "../../services/profileApi";
import { useAuthStore } from "../../stores/authStore";
import { useNotificationStore } from "../../stores/notificationStore";
import { CollectionForm } from "./CollectionForm";
import { DeletePostDialog } from "./DeletePostDialog";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileListFooter } from "./ProfileListFooter";
import { ProfileListHeader } from "./ProfileListHeader";
import { ProfilePostListItem } from "./ProfilePostListItem";
import { useProfileAvatar } from "./hooks/useProfileAvatar";
import {
  isCollectionFavorite,
  useProfileCollections,
} from "./hooks/useProfileCollections";
import { useProfileContent } from "./hooks/useProfileContent";
import { useProfilePostActions } from "./hooks/useProfilePostActions";
import type { ProfileTab } from "./ProfileStats";
import { CollectionsTabItem } from "./tabs/CollectionsTab";
import { FollowingTabItem } from "./tabs/FollowingTab";
import { useAppStyles } from "../../theme/ThemeProvider";

type LoggedInProfileScreenProps = {
  session: AuthSession;
  onOpenPost: (postId: number) => void;
  onEditPost: (postId: number) => void;
  onOpenAuthor: (authorId: number) => void;
  onOpenTag: (tag: string) => void;
  onOpenAnalytics: () => void;
  onOpenSettings: () => void;
};

export function LoggedInProfileScreen({
  session,
  onOpenPost,
  onEditPost,
  onOpenAuthor,
  onOpenTag,
  onOpenAnalytics,
  onOpenSettings,
}: LoggedInProfileScreenProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const logoutAuth = useAuthStore((state) => state.logout);
  const setAuthSession = useAuthStore((state) => state.setSession);
  const unreadByPostId = useNotificationStore((state) => state.unreadByPostId);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const {
    posts,
    setPosts,
    favorites,
    setFavorites,
    collections,
    setCollections,
    following,
    selectedCollection,
    setSelectedCollection,
    collectionPosts,
    setCollectionPosts,
    isContentLoading,
    setIsContentLoading,
    contentMessage,
    setContentMessage,
    hasLoadedProfileContent,
  } = useProfileContent(session);
  const {
    movingPost,
    setMovingPost,
    actionPostId,
    setActionPostId,
    postPendingDelete,
    setPostPendingDelete,
    editProfilePost,
    startMoveProfilePost,
    confirmDeletePost,
    handleDeletePost,
  } = useProfilePostActions({
    session,
    onEditPost,
    setPosts,
    setCollectionPosts,
    setIsContentLoading,
    setContentMessage,
  });
  const {
    collectionTitle,
    setCollectionTitle,
    collectionDescription,
    setCollectionDescription,
    editingCollection,
    isCollectionFormOpen,
    setIsCollectionFormOpen,
    resetCollectionForm,
    openCollection,
    submitCollection,
    startEditCollection,
    confirmDeleteCollection,
    movePostToCollection,
    removeCurrentCollectionPost,
    toggleCollectionFavorite,
  } = useProfileCollections({
    session,
    selectedCollection,
    setSelectedCollection,
    setCollectionPosts,
    setCollections,
    setFavorites,
    movingPost,
    setMovingPost,
    setIsContentLoading,
    setContentMessage,
    setActiveTab,
  });
  const { pickAvatar } = useProfileAvatar({
    session,
    setAuthSession,
    setIsContentLoading,
    setContentMessage,
  });

  function selectTab(tab: ProfileTab) {
    setSelectedCollection(null);
    setCollectionPosts([]);
    setMovingPost(null);
    setActionPostId(null);
    resetCollectionForm();
    setActiveTab(tab);
  }

  const sectionTitle = selectedCollection
    ? selectedCollection.title
    : activeTab === "posts"
      ? "我的发布"
      : activeTab === "favorites"
        ? "我的收藏"
        : activeTab === "following"
          ? "我的关注"
          : "我的合集";

  const avatarText =
    session.user.display_name.slice(0, 1) ||
    session.user.username.slice(0, 1) ||
    "我";
  const postsBadgeCount = posts.reduce(
    (count, post) => count + (unreadByPostId[post.id] || 0),
    0,
  );
  const showProfileSkeleton = useDelayedLoading(
    isContentLoading && !hasLoadedProfileContent && !contentMessage,
    250,
  );

  const currentData: (
    | ProfilePost
    | ProfileCollection
    | FollowingUser
    | ProfileFavorite
  )[] = selectedCollection
    ? collectionPosts
    : activeTab === "collections"
      ? collections
      : activeTab === "following"
        ? following
        : activeTab === "favorites"
          ? favorites
          : posts;

  const collectionForm =
    activeTab === "collections" && !selectedCollection ? (
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

  const profileHeaderContent = (
    <ProfileHeader
      user={session.user}
      avatarText={avatarText}
      onPickAvatar={() => void pickAvatar()}
      onOpenAnalytics={onOpenAnalytics}
      onOpenSettings={onOpenSettings}
      styles={styles}
      t={t}
    />
  );

  const header = (
    <ProfileListHeader
      user={session.user}
      activeTab={activeTab}
      postsCount={posts.length}
      favoritesCount={favorites.length}
      collectionsCount={collections.length}
      followingCount={following.length}
      postsBadgeCount={postsBadgeCount}
      selectedCollection={selectedCollection}
      sectionTitle={sectionTitle}
      collectionForm={collectionForm}
      profileHeaderContent={profileHeaderContent}
      onLogout={logoutAuth}
      onSelectTab={selectTab}
      onBackFromCollection={() => setSelectedCollection(null)}
      styles={styles}
      t={t}
    />
  );

  const footer = () => (
    <ProfileListFooter
      isLoading={isContentLoading}
      message={contentMessage}
      styles={styles}
      t={t}
    />
  );

  if (showProfileSkeleton) {
    return <ProfileScreenSkeleton />;
  }

  const renderItem = ({
    item,
  }: {
    item: ProfilePost | ProfileCollection | FollowingUser | ProfileFavorite;
  }) => {
    if (activeTab === "collections" && !selectedCollection) {
      const collection = item as ProfileCollection;
      return (
        <CollectionsTabItem
          collection={collection}
          onOpen={openCollection}
          onEdit={startEditCollection}
          onDelete={confirmDeleteCollection}
        />
      );
    }
    if (
      activeTab === "favorites" &&
      !selectedCollection &&
      isCollectionFavorite(item)
    ) {
      const collection = item as ProfileCollection;
      return (
        <CollectionCard
          key={`collection-${collection.id}`}
          collection={collection}
          tone="favorite"
          onPress={() => openCollection(collection)}
          actions={[
            {
              label: "取消收藏",
              onPress: () => toggleCollectionFavorite(collection),
            },
          ]}
        />
      );
    }
    if (activeTab === "following" && !selectedCollection) {
      return (
        <FollowingTabItem
          user={item as FollowingUser}
          onOpenAuthor={onOpenAuthor}
        />
      );
    }
    const post = item as ProfilePost;
    const hasCommentNotification = (unreadByPostId[post.id] || 0) > 0;
    return (
      <ProfilePostListItem
        post={post}
        activeTab={activeTab}
        selectedCollection={selectedCollection}
        actionPostId={actionPostId}
        movingPost={movingPost}
        collections={collections}
        hasCommentNotification={hasCommentNotification}
        onEditPost={editProfilePost}
        onStartMovePost={startMoveProfilePost}
        onConfirmDeletePost={confirmDeletePost}
        onCloseActions={() => setActionPostId(null)}
        onMoveToCollection={movePostToCollection}
        onCancelMove={() => setMovingPost(null)}
        onOpenPost={(nextPostId) => {
          setActionPostId(null);
          onOpenPost(nextPostId);
        }}
        onLongPressPost={setActionPostId}
        onOpenTag={onOpenTag}
        onRemoveFromCollection={removeCurrentCollectionPost}
        styles={styles}
        t={t}
      />
    );
  };

  return (
    <>
      <FlatList
        contentContainerStyle={styles.pageContent}
        data={currentData}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          !isContentLoading && !contentMessage ? (
            <Text
              style={[styles.profileBio, { textAlign: "center", padding: 16 }]}
            >
              {t("暂无内容")}
            </Text>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      <DeletePostDialog
        post={postPendingDelete}
        onCancel={() => setPostPendingDelete(null)}
        onConfirm={(post) => void handleDeletePost(post)}
        styles={styles}
        t={t}
      />
    </>
  );
}
