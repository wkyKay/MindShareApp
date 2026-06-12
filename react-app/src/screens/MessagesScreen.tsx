import { ScrollView, Text } from "react-native";

import { useAuthStore } from "../stores/authStore";
import { useMessageStore } from "../stores/messageStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useTranslation } from "react-i18next";
import { useAppStyles } from "../theme/ThemeProvider";
import { ConversationList } from "./messages/ConversationList";
import { FollowingMessagePanel } from "./messages/FollowingMessagePanel";
import { useMessageSearch } from "./messages/hooks/useMessageSearch";
import { usePrivateMessages } from "./messages/hooks/usePrivateMessages";
import { MessagesGuestView } from "./messages/MessagesGuestView";
import { MessageSearchSection } from "./messages/MessageSearchSection";
import { MessageShortcutGrid } from "./messages/MessageShortcutGrid";

type NotificationCategory = "comments" | "likes" | "follows";

type MessagesScreenProps = {
  onOpenAuth: () => void;
  onOpenChat: (
    conversationId: number,
    partnerId: number,
    partnerName: string,
  ) => void;
  onOpenNotificationCategory: (category: NotificationCategory) => void;
};

export function MessagesScreen({
  onOpenAuth,
  onOpenChat,
  onOpenNotificationCategory,
}: MessagesScreenProps) {
  const styles = useAppStyles();
  const session = useAuthStore((state) => state.session);
  const latestMessageByConversation = useMessageStore(
    (state) => state.latestMessageByConversation,
  );
  const unreadByConversation = useMessageStore(
    (state) => state.unreadByConversation,
  );
  const notifications = useNotificationStore((state) => state.notifications);
  const { searchQuery, searchResults, setSearchQuery } =
    useMessageSearch(session);
  const {
    conversations,
    following,
    message,
    removeConversation,
    startChat,
  } = usePrivateMessages({ session, onOpenAuth, onOpenChat });

  const commentUnread = notifications.filter(
    (item) =>
      !item.is_read &&
      (item.type === "comment_created" || item.type === "comment_reply"),
  ).length;
  const likeUnread = notifications.filter(
    (item) =>
      !item.is_read &&
      (item.type === "post_liked" || item.type === "comment_liked"),
  ).length;
  const followUnread = notifications.filter(
    (item) => !item.is_read && item.type === "user_followed",
  ).length;
  const { t } = useTranslation();

  if (!session) {
    return <MessagesGuestView onOpenAuth={onOpenAuth} styles={styles} t={t} />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>{t("消息")}</Text>
      <Text style={styles.messageCenterSubtitle}>
        {t("查看与你相关的互动消息和私信会话。")}
      </Text>

      <MessageSearchSection
        query={searchQuery}
        results={searchResults}
        onChangeQuery={setSearchQuery}
        onStartChat={(partnerId, partnerName) =>
          void startChat(partnerId, partnerName)
        }
        styles={styles}
        t={t}
      />

      <MessageShortcutGrid
        commentUnread={commentUnread}
        likeUnread={likeUnread}
        followUnread={followUnread}
        onOpenNotificationCategory={onOpenNotificationCategory}
        styles={styles}
        t={t}
      />

      <FollowingMessagePanel
        following={following}
        onStartChat={(partnerId, partnerName) =>
          void startChat(partnerId, partnerName)
        }
        styles={styles}
        t={t}
      />

      <ConversationList
        conversations={conversations}
        latestMessageByConversation={latestMessageByConversation}
        unreadByConversation={unreadByConversation}
        onOpenChat={onOpenChat}
        onDeleteConversation={(conversationId) =>
          void removeConversation(conversationId)
        }
        styles={styles}
        t={t}
      />

      {!!message && (
        <Text style={[styles.authApiHint, { color: "#a05d6f" }]}>
          {message}
        </Text>
      )}
    </ScrollView>
  );
}
