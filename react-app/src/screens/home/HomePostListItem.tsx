import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PostCard } from "../../components/PostCard";
import type { AppStyles } from "../../components/styles";
import type { Post } from "../../services/homeApi";

type HomePostListItemProps = {
  actionPostId: number | null;
  onClearAction: () => void;
  onDislikePost: (postId: number) => void;
  onOpenPost: (postId: number) => void;
  onOpenTag: (tag: string) => void;
  onShowAction: (postId: number) => void;
  post: Post;
  styles: AppStyles;
  t: (key: string) => string;
};

export function HomePostListItem({
  actionPostId,
  onClearAction,
  onDislikePost,
  onOpenPost,
  onOpenTag,
  onShowAction,
  post,
  styles,
  t,
}: HomePostListItemProps) {
  return (
    <View>
      {actionPostId === post.id ? (
        <View style={styles.postCardActionMenuRow}>
          <Pressable
            style={styles.postCardActionButton}
            onPress={() => onDislikePost(post.id)}
          >
            <Text style={styles.postCardActionText}>{t("不喜欢")}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.postCardActionButton,
              styles.postCardActionButtonMuted,
            ]}
            onPress={onClearAction}
          >
            <Ionicons name="close" size={16} color="#a05d6f" />
          </Pressable>
        </View>
      ) : null}
      <PostCard
        post={post}
        showAuthor
        showStats
        onPress={() => {
          onClearAction();
          onOpenPost(post.id);
        }}
        onLongPress={() => onShowAction(post.id)}
        onOpenTag={onOpenTag}
      />
    </View>
  );
}
