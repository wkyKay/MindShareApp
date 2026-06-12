import { useCallback } from "react";
import { FlatList, type ListRenderItem } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import type { NotificationItem } from "../services/notificationsApi";
import { useAuthStore } from "../stores/authStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useTranslation } from "react-i18next";
import { useAppStyles } from "../theme/ThemeProvider";
import { NotificationGuestView } from "./notifications/NotificationGuestView";
import { NotificationHeader } from "./notifications/NotificationHeader";
import { NotificationListEmpty } from "./notifications/NotificationListEmpty";
import { NotificationListItem } from "./notifications/NotificationListItem";

type NotificationScreenProps = {
  onOpenAuth: () => void;
  onBack: () => void;
  category: "comments" | "likes" | "follows";
  onOpenPost: (postId: number, focusCommentId?: number) => void;
  onOpenAuthor: (authorId: number) => void;
};

export function NotificationScreen({
  onOpenAuth,
  onBack,
  category,
  onOpenPost,
  onOpenAuthor,
}: NotificationScreenProps) {
  const styles = useAppStyles();
  const session = useAuthStore((state) => state.session);
  const notifications = useNotificationStore((state) => state.notifications);
  const filteredNotifications = notifications.filter((item) =>
    matchesCategory(item.type, category),
  );
  const refreshNotifications = useNotificationStore(
    (state) => state.refreshNotifications,
  );
  const markPostRead = useNotificationStore((state) => state.markPostRead);
  const markNotificationRead = useNotificationStore(
    (state) => state.markNotificationRead,
  );
  const { t } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      void refreshNotifications(session);
    }, [refreshNotifications, session]),
  );

  const handleOpenNotification = useCallback(
    (item: NotificationItem) => {
      void markNotificationRead(session, item.id);
      if (item.type === "user_followed") {
        onOpenAuthor(item.actor.id);
        return;
      }
      if (item.post_id > 0) {
        void markPostRead(session, item.post_id);
        onOpenPost(item.post_id, item.comment_id > 0 ? item.comment_id : undefined);
      }
    },
    [markNotificationRead, markPostRead, onOpenAuthor, onOpenPost, session],
  );

  const renderNotificationItem: ListRenderItem<NotificationItem> = useCallback(
    ({ item }) => (
      <NotificationListItem
        item={item}
        title={buildNotificationTitle(item, t)}
        styles={styles}
        onPress={handleOpenNotification}
      />
    ),
    [handleOpenNotification, styles, t],
  );

  if (!session) {
    return (
      <NotificationGuestView
        onBack={onBack}
        onOpenAuth={onOpenAuth}
        styles={styles}
        t={t}
      />
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.pageContent}
      data={filteredNotifications}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <NotificationHeader
          title={getCategoryTitle(category, t)}
          onBack={onBack}
          styles={styles}
          t={t}
        />
      }
      ListEmptyComponent={<NotificationListEmpty styles={styles} t={t} />}
      renderItem={renderNotificationItem}
      showsVerticalScrollIndicator={false}
    />
  );
}

function getCategoryTitle(
  category: "comments" | "likes" | "follows",
  t: (key: string) => string,
) {
  if (category === "comments") return t("评论我的");
  if (category === "likes") return t("赞和喜欢");
  return t("关注我的");
}

function matchesCategory(
  type: string,
  category: "comments" | "likes" | "follows",
) {
  if (category === "comments") {
    return type === "comment_created" || type === "comment_reply";
  }
  if (category === "likes") {
    return type === "post_liked" || type === "comment_liked";
  }
  return type === "user_followed";
}

function buildNotificationTitle(
  item: {
    type:
      | "comment_created"
      | "comment_reply"
      | "comment_liked"
      | "post_liked"
      | "post_favorited"
      | "collection_favorited"
      | "user_followed";
    actor: { display_name: string };
    post_title?: string | null;
  },
  t: (key: string, options?: Record<string, string>) => string,
) {
  const postTitle =
    "post_title" in item && item.post_title ? `《${item.post_title}》` : "";
  if (item.type === "user_followed") {
    return t("{{actor}} 关注了你", { actor: item.actor.display_name });
  }
  if (item.type === "post_liked") {
    return t("{{actor}} 点赞了你的帖子{{postTitle}}", {
      actor: item.actor.display_name,
      postTitle,
    });
  }
  if (item.type === "post_favorited") {
    return t("{{actor}} 收藏了你的帖子{{postTitle}}", {
      actor: item.actor.display_name,
      postTitle,
    });
  }
  if (item.type === "collection_favorited") {
    return t("{{actor}} 收藏了你的合集", { actor: item.actor.display_name });
  }
  if (item.type === "comment_liked") {
    return t("{{actor}} 点赞了你的评论{{postTitle}}", {
      actor: item.actor.display_name,
      postTitle,
    });
  }
  return item.type === "comment_reply"
    ? t("{{actor}} 回复了你在{{postTitle}}中的评论", {
        actor: item.actor.display_name,
        postTitle,
      })
    : t("{{actor}} 评论了你的帖子{{postTitle}}", {
        actor: item.actor.display_name,
        postTitle,
      });
}
