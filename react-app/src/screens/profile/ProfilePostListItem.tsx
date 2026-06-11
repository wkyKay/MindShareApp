import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PostCard } from "../../components/PostCard";
import type { AppStyles } from "../../components/styles";
import type { ProfileCollection, ProfilePost } from "../../services/profileApi";
import { MovePostPanel } from "./MovePostPanel";
import type { ProfileTab } from "./ProfileStats";

type ProfilePostListItemProps = {
  post: ProfilePost;
  activeTab: ProfileTab;
  selectedCollection: ProfileCollection | null;
  actionPostId: number | null;
  movingPost: ProfilePost | null;
  collections: ProfileCollection[];
  hasCommentNotification: boolean;
  onEditPost: (post: ProfilePost) => void;
  onStartMovePost: (post: ProfilePost) => void;
  onConfirmDeletePost: (post: ProfilePost) => void;
  onCloseActions: () => void;
  onMoveToCollection: (collection: ProfileCollection) => void;
  onCancelMove: () => void;
  onOpenPost: (postId: number) => void;
  onLongPressPost: (postId: number) => void;
  onOpenTag: (tag: string) => void;
  onRemoveFromCollection: (post: ProfilePost) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function ProfilePostListItem({
  post,
  activeTab,
  selectedCollection,
  actionPostId,
  movingPost,
  collections,
  hasCommentNotification,
  onEditPost,
  onStartMovePost,
  onConfirmDeletePost,
  onCloseActions,
  onMoveToCollection,
  onCancelMove,
  onOpenPost,
  onLongPressPost,
  onOpenTag,
  onRemoveFromCollection,
  styles,
  t,
}: ProfilePostListItemProps) {
  const showAuthor = !selectedCollection && activeTab === "favorites";
  const showPostActions =
    activeTab === "posts" && !selectedCollection && actionPostId === post.id;
  const canManagePost = activeTab === "posts" && !selectedCollection;

  return (
    <View>
      {showPostActions ? (
        <View style={styles.postCardActionMenuRow}>
          <Pressable
            style={[styles.postCardActionButton, styles.postCardActionButtonMuted]}
            onPress={() => onEditPost(post)}
          >
            <Text style={styles.postCardActionText}>{t("编辑")}</Text>
          </Pressable>
          <Pressable
            style={[styles.postCardActionButton, styles.postCardActionButtonMuted]}
            onPress={() => onStartMovePost(post)}
          >
            <Text style={styles.postCardActionText}>{t("加入合集")}</Text>
          </Pressable>
          <Pressable
            style={[styles.postCardActionButton, styles.postCardDeleteButton]}
            onPress={() => onConfirmDeletePost(post)}
          >
            <Text style={styles.postCardDeleteText}>{t("删除")}</Text>
          </Pressable>
          <Pressable
            style={[styles.postCardActionButton, styles.postCardActionButtonMuted]}
            onPress={onCloseActions}
          >
            <Ionicons name="close" size={16} color="#a05d6f" />
          </Pressable>
        </View>
      ) : null}

      {canManagePost ? (
        <MovePostPanel
          post={post}
          collections={collections}
          isOpen={movingPost?.id === post.id}
          onMoveToCollection={onMoveToCollection}
          onCancel={onCancelMove}
        />
      ) : null}
      <PostCard
        key={post.id}
        post={post}
        showAuthor={showAuthor}
        showStats
        hasCommentNotification={canManagePost && hasCommentNotification}
        onPress={() => onOpenPost(post.id)}
        onLongPress={canManagePost ? () => onLongPressPost(post.id) : undefined}
        onOpenTag={onOpenTag}
      />

      {selectedCollection ? (
        <View
          style={[styles.compactActionRow, { marginTop: -8, marginBottom: 14 }]}
        >
          <Pressable
            style={[styles.compactActionButton, styles.compactDangerButton]}
            onPress={() => onRemoveFromCollection(post)}
          >
            <Text style={[styles.compactActionText, styles.compactDangerText]}>
              {t("移出合集")}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
