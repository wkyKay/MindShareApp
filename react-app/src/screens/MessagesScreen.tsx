import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Swipeable } from "react-native-gesture-handler";

import { styles } from "../components/styles";
import {
  createOrGetConversation,
  deleteConversation,
  getFollowingUsers,
  listConversations,
  searchUsers,
  type ConversationItem,
  type SearchUserItem,
} from "../services/messagesApi";
import { useAuthStore } from "../stores/authStore";
import { useMessageStore } from "../stores/messageStore";
import { useNotificationStore } from "../stores/notificationStore";
import { formatDateTimeMinute } from "../utils/time";
import { useTranslation } from "react-i18next";

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
  const session = useAuthStore((state) => state.session);
  const latestMessageByConversation = useMessageStore(
    (state) => state.latestMessageByConversation,
  );
  const unreadByConversation = useMessageStore(
    (state) => state.unreadByConversation,
  );
  const notifications = useNotificationStore((state) => state.notifications);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [following, setFollowing] = useState<SearchUserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUserItem[]>([]);
  const [message, setMessage] = useState("");

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

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      void loadPrivateMessages();
    }, [session]),
  );

  useEffect(() => {
    let isMounted = true;
    const q = searchQuery.trim();
    if (!session) return;
    if (!q) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await searchUsers(session.accessToken, q);
        if (isMounted) setSearchResults(data);
      } catch {
        if (isMounted) setSearchResults([]);
      }
    }, 250);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, session]);

  async function loadPrivateMessages() {
    if (!session) return;
    try {
      const [conversationData, followingData] = await Promise.all([
        listConversations(session.accessToken),
        getFollowingUsers(session.accessToken),
      ]);
      setConversations(conversationData);
      setFollowing(followingData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "私信加载失败");
    }
  }

  async function startChat(partnerId: number, partnerName: string) {
    if (!session) {
      onOpenAuth();
      return;
    }
    const data = await createOrGetConversation(session.accessToken, partnerId);
    onOpenChat(data.id, partnerId, partnerName);
  }

  async function removeConversation(conversationId: number) {
    if (!session) return;
    setConversations((current) =>
      current.filter((item) => item.id !== conversationId),
    );
    try {
      await deleteConversation(session.accessToken, conversationId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除会话失败");
      void loadPrivateMessages();
    }
  }

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.pageContent}>
        <Text style={styles.pageTitle}>{t("消息")}</Text>
        <Text style={styles.profileBio}>
          {t("登录后可以查看互动消息和私信。")}
        </Text>
        <Pressable style={styles.primaryButton} onPress={onOpenAuth}>
          <Text style={styles.primaryButtonText}>{t("去登录")}</Text>
        </Pressable>
      </ScrollView>
    );
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

      <View style={styles.messageSearchRow}>
        <TextInput
          style={styles.messageSearchInput}
          placeholder={t("搜索用户昵称或用户名")}
          placeholderTextColor="#9a8f8a"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <Ionicons name="search-outline" size={20} color="#a05d6f" />
      </View>

      {searchResults.length > 0 ? (
        <View style={styles.messageSearchResults}>
          {searchResults.map((user) => (
            <Pressable
              key={`search-${user.id}`}
              style={styles.messageUserRow}
              onPress={() => void startChat(user.id, user.display_name)}
            >
              <MessageAvatar
                name={user.display_name}
                avatarUrl={user.avatar_url}
              />

              <View style={styles.messageRowTextBlock}>
                <Text style={styles.cardTitle}>{user.display_name}</Text>
                <Text style={styles.profileBio}>@{user.username}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.messageShortcutGrid}>
        <MessageShortcut
          icon="chatbubble-ellipses-outline"
          label={t("评论我的")}
          unreadCount={commentUnread}
          onPress={() => onOpenNotificationCategory("comments")}
        />

        <MessageShortcut
          icon="heart-outline"
          label={t("赞过我的")}
          unreadCount={likeUnread}
          onPress={() => onOpenNotificationCategory("likes")}
        />

        <MessageShortcut
          icon="person-add-outline"
          label={t("关注我的")}
          unreadCount={followUnread}
          onPress={() => onOpenNotificationCategory("follows")}
        />
      </View>

      <View style={styles.messagePanel}>
        <Text style={styles.sectionTitle}>{t("关注的人")}</Text>
        {following.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.followingMessageScroller}
          >
            {following.map((user) => (
              <Pressable
                key={`follow-${user.id}`}
                style={styles.followingMessageItem}
                onPress={() => void startChat(user.id, user.display_name)}
              >
                <MessageAvatar
                  name={user.display_name}
                  avatarUrl={user.avatar_url}
                />

                <Text style={styles.followingMessageName} numberOfLines={1}>
                  {user.display_name}
                </Text>
                <Text style={styles.followingMessageUsername} numberOfLines={1}>
                  @{user.username}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.profileBio}>{t("暂无关注用户。")}</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>{t("会话")}</Text>
      {conversations.length > 0 ? (
        conversations.map((item) => (
          <SwipeConversationRow
            key={item.id}
            item={item}
            latestBody={
              latestMessageByConversation[item.id]?.body ||
              item.last_message?.body ||
              t("暂无消息")
            }
            unreadCount={unreadByConversation[item.id] || item.unread_count}
            onOpen={() =>
              onOpenChat(item.id, item.partner.id, item.partner.display_name)
            }
            onDelete={() => void removeConversation(item.id)}
            t={t}
          />
        ))
      ) : (
        <Text style={styles.profileBio}>
          {t("暂无会话，先从上方关注列表或搜索里发起私信。")}
        </Text>
      )}

      {!!message && (
        <Text style={[styles.authApiHint, { color: "#a05d6f" }]}>
          {message}
        </Text>
      )}
    </ScrollView>
  );
}

function SwipeConversationRow({
  item,
  latestBody,
  unreadCount,
  onOpen,
  onDelete,
  t,
}: {
  item: ConversationItem;
  latestBody: string;
  unreadCount: number;
  onOpen: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}) {
  const swipeableRef = useRef<Swipeable>(null);

  function renderRightActions() {
    return (
      <Pressable style={styles.swipeDeleteButton} onPress={onDelete}>
        <Text style={styles.swipeDeleteText}>{t("删除")}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.swipeConversationContainer}>
      <Swipeable
        ref={swipeableRef}
        friction={1.6}
        rightThreshold={36}
        overshootRight={false}
        renderRightActions={renderRightActions}
      >
        <Pressable style={styles.messageConversationCard} onPress={onOpen}>
          <MessageAvatar
            name={item.partner.display_name}
            avatarUrl={item.partner.avatar_url}
          />

          <View style={styles.messageRowTextBlock}>
            <Text style={styles.cardTitle}>{item.partner.display_name}</Text>
            <Text style={styles.messageLastText}>{latestBody}</Text>
          </View>
          <View style={styles.messageConversationSideMeta}>
            <Text style={styles.messageTimeText}>
              {formatDateTimeMinute(item.updated_at)}
            </Text>
            {unreadCount > 0 ? (
              <View style={styles.messageUnreadBadge}>
                <Text style={styles.messageUnreadText}>{unreadCount}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Swipeable>
    </View>
  );
}

function MessageAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  const { t } = useTranslation();
  const initial = name.trim().slice(0, 1) || t("聊");
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.messageAvatar} />;
  }
  return (
    <View style={styles.messageAvatarFallback}>
      <Text style={styles.messageAvatarText}>{initial}</Text>
    </View>
  );
}

function MessageShortcut({
  icon,
  label,
  unreadCount,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  unreadCount: number;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.messageShortcutCard} onPress={onPress}>
      <View style={styles.messageShortcutIconWrap}>
        <Ionicons name={icon} size={25} color="#d94f70" />
        {unreadCount > 0 ? <View style={styles.messageShortcutDot} /> : null}
      </View>
      <Text style={styles.messageShortcutLabel}>{label}</Text>
    </Pressable>
  );
}
