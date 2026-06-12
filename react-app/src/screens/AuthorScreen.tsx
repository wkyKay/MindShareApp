import { useCallback, useState } from "react";
import { Pressable, Text, View, FlatList } from "react-native";
import { CollectionCard } from "../components/CollectionCard";
import { PostCard } from "../components/PostCard";
import type { ProfilePost, ProfileCollection } from "../services/authorApi";
import type { AuthSession } from "../services/authSession";
import { useTranslation } from "react-i18next";
import { useAppStyles } from "../theme/ThemeProvider";
import { useAuthorContent } from "./author/hooks/useAuthorContent";

type AuthorTab = "posts" | "collections";

type AuthorProps = {
  author_id: number;
  onOpenPost: (postId: number) => void;
  onOpenMessage: (
    conversationId: number,
    partnerId: number,
    partnerName: string,
  ) => void;
  onBack: () => void;
  onRequireAuth: () => void;
  onOpenTag: (tag: string) => void;
  session: AuthSession | null;
};
export function AuthorScreen({
  author_id,
  onOpenPost,
  onOpenMessage,
  onBack,
  onRequireAuth,
  onOpenTag,
  session,
}: AuthorProps) {
  const styles = useAppStyles();
  const [activeTab, setActiveTab] = useState<AuthorTab>("posts");
  const { t } = useTranslation();

  const {
    isLoading,
    isLoadingMore,
    message,
    author,
    toggleFollow,
    openMessage,
    posts,
    postTotal,
    loadMorePosts,
    collections,
    selectedCollection,
    setSelectedCollection,
    collectionPosts,
    openCollection,
    toggleCollectionFavorite,
  } = useAuthorContent({
    authorId: author_id,
    session,
    onOpenMessage,
    onRequireAuth,
  });

  const renderItem = useCallback(
    ({ item }: { item: ProfilePost | ProfileCollection }) =>
      activeTab === "posts" || selectedCollection ? (
        <PostCard
          post={item as ProfilePost}
          showStats
          onPress={() => onOpenPost(item.id)}
          onOpenTag={onOpenTag}
        />
      ) : (
        <CollectionCard
          collection={item as ProfileCollection}
          onPress={() => openCollection(item as ProfileCollection)}
          actions={
            author?.id === session?.user.id
              ? []
              : [
                  {
                    label: (item as ProfileCollection).is_favorited
                      ? "取消收藏"
                      : "收藏合集",
                    onPress: () =>
                      toggleCollectionFavorite(item as ProfileCollection),
                  },
                ]
          }
        />
      ),
    [
      activeTab,
      author?.id,
      onOpenPost,
      onOpenTag,
      openCollection,
      selectedCollection,
      session?.user.id,
      toggleCollectionFavorite,
    ],
  );

  const avatarText =
    author?.display_name.slice(0, 1) || author?.username.slice(0, 1) || "我";
  const currentData: (ProfilePost | ProfileCollection)[] = selectedCollection
    ? collectionPosts
    : activeTab === "posts"
      ? posts
      : collections;

  const header = (
    <>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>{t("返回")}</Text>
      </Pressable>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarText}</Text>
        </View>
        <View>
          <Text style={styles.pageTitle}>{author?.display_name}</Text>
          {author?.bio ? (
            <Text style={styles.profileBio}>{author.bio}</Text>
          ) : null}
        </View>
      </View>

      {author && author.id !== session?.user.id ? (
        <Pressable
          style={[
            styles.primaryButton,
            author.is_following && styles.actionButtonActive,
          ]}
          onPress={toggleFollow}
        >
          <Text
            style={
              author.is_following
                ? styles.actionButtonText
                : styles.primaryButtonText
            }
          >
            {author.is_following ? "已关注，点击取消" : "关注作者"}
          </Text>
        </Pressable>
      ) : null}
      {author && author.id !== session?.user.id ? (
        <Pressable style={styles.secondaryButton} onPress={openMessage}>
          <Text style={styles.secondaryButtonText}>{t("私信")}</Text>
        </Pressable>
      ) : null}
      {message ? <Text style={styles.authApiHint}>{message}</Text> : null}

      <View style={styles.profileStats}>
        <Pressable
          style={styles.profileStatItem}
          onPress={() => {
            setSelectedCollection(null);
            setActiveTab("posts");
          }}
        >
          <Text style={styles.profileStatNumber}>{postTotal}</Text>
          <Text
            style={[
              styles.profileStatLabel,
              activeTab === "posts" && styles.segmentTextActive,
            ]}
          >
            {t("发布")}
          </Text>
        </Pressable>
        <Pressable
          style={styles.profileStatItem}
          onPress={() => {
            setSelectedCollection(null);
            setActiveTab("collections");
          }}
        >
          <Text style={styles.profileStatNumber}>{collections.length}</Text>
          <Text
            style={[
              styles.profileStatLabel,
              activeTab === "collections" && styles.segmentTextActive,
            ]}
          >
            {t("合集")}
          </Text>
        </Pressable>
      </View>
      {selectedCollection ? (
        <>
          <Pressable
            style={styles.backButton}
            onPress={() => setSelectedCollection(null)}
          >
            <Text style={styles.backButtonText}>{t("‹ 返回合集")}</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>{selectedCollection.title}</Text>
          {!!selectedCollection.description && (
            <Text style={styles.profileBio}>
              {selectedCollection.description}
            </Text>
          )}
        </>
      ) : null}
    </>
  );

  const footer = () => {
    if (isLoading || isLoadingMore) {
      return (
        <Text style={[styles.profileBio, { padding: 16, textAlign: "center" }]}>
          {t("正在加载内容...")}
        </Text>
      );
    }
    if (message) {
      return (
        <Text style={[styles.authApiHint, { color: "#a05d6f", padding: 16 }]}>
          {message}
        </Text>
      );
    }
    return null;
  };

  return (
    <FlatList
      contentContainerStyle={styles.pageContent}
      data={currentData}
      renderItem={renderItem}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={
        !isLoading && !message ? (
          <Text
            style={[styles.profileBio, { textAlign: "center", padding: 16 }]}
          >
            {t("暂无内容")}
          </Text>
        ) : null
      }
      onEndReached={() => {
        void loadMorePosts(activeTab);
      }}
      onEndReachedThreshold={0.35}
      showsVerticalScrollIndicator={false}
    />
  );
}
