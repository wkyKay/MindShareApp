import { View } from "react-native";

import type { AppStyles } from "../../components/styles";
import { MessageShortcut } from "./MessageShortcut";

type NotificationCategory = "comments" | "likes" | "follows";

type MessageShortcutGridProps = {
  commentUnread: number;
  likeUnread: number;
  followUnread: number;
  onOpenNotificationCategory: (category: NotificationCategory) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function MessageShortcutGrid({
  commentUnread,
  likeUnread,
  followUnread,
  onOpenNotificationCategory,
  styles,
  t,
}: MessageShortcutGridProps) {
  return (
    <View style={styles.messageShortcutGrid}>
      <MessageShortcut
        icon="chatbubble-ellipses-outline"
        label={t("评论我的")}
        unreadCount={commentUnread}
        onPress={() => onOpenNotificationCategory("comments")}
        styles={styles}
      />

      <MessageShortcut
        icon="heart-outline"
        label={t("赞过我的")}
        unreadCount={likeUnread}
        onPress={() => onOpenNotificationCategory("likes")}
        styles={styles}
      />

      <MessageShortcut
        icon="person-add-outline"
        label={t("关注我的")}
        unreadCount={followUnread}
        onPress={() => onOpenNotificationCategory("follows")}
        styles={styles}
      />
    </View>
  );
}
