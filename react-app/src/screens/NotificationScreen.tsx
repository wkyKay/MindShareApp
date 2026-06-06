import { useCallback } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { styles } from "../components/styles";
import { useAuthStore } from "../stores/authStore";
import { useNotificationStore } from "../stores/notificationStore";
import { formatDateTimeMinute } from "../utils/time";
import { useTranslation } from "react-i18next";

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

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.pageHeaderRow}>
          <Pressable style={styles.backButtonCompact} onPress={onBack}>
            <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
          </Pressable>
          <Text style={styles.pageTitle}>{t("消息通知")}</Text>
        </View>
        <Text style={styles.profileBio}>
          {t("登录后可以查看你的消息通知。")}
        </Text>
        <Pressable style={styles.primaryButton} onPress={onOpenAuth}>
          <Text style={styles.primaryButtonText}>{t("去登录")}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.pageContent}
      data={filteredNotifications}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <View style={styles.pageHeaderRow}>
          <Pressable style={styles.backButtonCompact} onPress={onBack}>
            <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
          </Pressable>
          <Text style={styles.pageTitle}>{getCategoryTitle(category, t)}</Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={[styles.profileBio, { paddingTop: 16 }]}>
          {t("暂时没有这类通知。")}
        </Text>
      }
      renderItem={({ item }) => (
        <Pressable
          style={[
            styles.notificationCard,
            item.is_read && styles.notificationCardRead,
          ]}
          onPress={() => {
            void markNotificationRead(session, item.id);
            if (item.type === "user_followed") {
              onOpenAuthor(item.actor.id);
              return;
            }
            if (item.post_id > 0) {
              void markPostRead(session, item.post_id);
              onOpenPost(
                item.post_id,
                item.comment_id > 0 ? item.comment_id : undefined,
              );
            }
          }}
        >
          <View style={styles.notificationTitleRow}>
            <Text style={styles.notificationTitle}>
              {buildNotificationTitle(item, t)}
            </Text>
            {!item.is_read ? <View style={styles.cardNotificationDot} /> : null}
          </View>
          <Text
            style={[
              styles.notificationMeta,
              item.is_read && styles.notificationMetaRead,
            ]}
          >
            {formatDateTimeMinute(item.created_at)}
          </Text>
        </Pressable>
      )}
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
