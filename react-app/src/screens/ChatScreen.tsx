import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "../stores/authStore";
import { useMessageStore } from "../stores/messageStore";
import {
  listMessages,
  markConversationRead,
  sendMessage,
  type Message,
} from "../services/messagesApi";
import { formatDateTimeMinute, sameMinute } from "../utils/time";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../theme/ThemeProvider";

type ChatScreenProps = {
  conversationId: number;
  partnerId: number;
  partnerName: string;
  onBack: () => void;
  onRequireAuth: () => void;
};

const MESSAGE_PAGE_SIZE = 50;

type ListMode = "measure" | "normal" | "inverted";

export function ChatScreen({
  conversationId,
  partnerId,
  partnerName,
  onBack,
  onRequireAuth,
}: ChatScreenProps) {
  const { colors, styles } = useAppTheme();
  const session = useAuthStore((state) => state.session);
  const latestMessage = useMessageStore(
    (state) => state.latestMessageByConversation[conversationId],
  );
  const markConversationReadLocal = useMessageStore(
    (state) => state.markConversationRead,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [listMode, setListMode] = useState<ListMode>("measure");
  const listRef = useRef<FlatList<Message>>(null);
  const loadingOlderMessagesRef = useRef(false);
  const userScrolledRef = useRef(false);
  const listHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const useInvertedList = listMode === "inverted";
  const visibleMessages = useMemo(
    () => (useInvertedList ? [...messages].reverse() : messages),
    [messages, useInvertedList],
  );
  const { t } = useTranslation();

  const loadLatestMessages = useCallback(async () => {
    if (!session || !conversationId) return;
    try {
      loadingOlderMessagesRef.current = false;
      userScrolledRef.current = false;
      contentHeightRef.current = 0;
      setMessages([]);
      setListMode("measure");
      setPage(1);
      setHasMoreMessages(true);
      const data = await listMessages(
        session.accessToken,
        conversationId,
        1,
        MESSAGE_PAGE_SIZE,
      );
      setMessages(data);
      setHasMoreMessages(data.length === MESSAGE_PAGE_SIZE);
      if (!data.length) {
        setListMode("normal");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "消息加载失败");
    }
  }, [conversationId, session]);

  useFocusEffect(
    useCallback(() => {
      if (!session || !conversationId) return;
      void loadLatestMessages();
      void markConversationRead(session.accessToken, conversationId);
      void markConversationReadLocal(session, conversationId);
    }, [conversationId, loadLatestMessages, markConversationReadLocal, session]),
  );

  useEffect(() => {
    if (!latestMessage) {
      return;
    }
    setMessages((current) =>
      current.some((item) => item.id === latestMessage.id)
        ? current
        : [...current, latestMessage],
    );
    requestAnimationFrame(() => {
      if (useInvertedList) {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      } else {
        listRef.current?.scrollToEnd({ animated: false });
      }
    });
  }, [latestMessage, useInvertedList]);

  async function loadOlderMessages() {
    if (
      !session ||
      !conversationId ||
      listMode === "measure" ||
      (useInvertedList && !userScrolledRef.current) ||
      !hasMoreMessages ||
      loadingOlderMessagesRef.current
    ) {
      return;
    }
    const nextPage = page + 1;
    loadingOlderMessagesRef.current = true;
    try {
      const data = await listMessages(
        session.accessToken,
        conversationId,
        nextPage,
        MESSAGE_PAGE_SIZE,
      );
      setMessages((current) => {
        const currentIds = new Set(current.map((item) => item.id));
        const olderMessages = data.filter((item) => !currentIds.has(item.id));
        return [...olderMessages, ...current];
      });
      setPage(nextPage);
      setHasMoreMessages(data.length === MESSAGE_PAGE_SIZE);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "消息加载失败");
    } finally {
      loadingOlderMessagesRef.current = false;
    }
  }

  function resolveListMode() {
    if (listMode !== "measure" || !listHeightRef.current || !contentHeightRef.current) {
      return;
    }
    setListMode(contentHeightRef.current > listHeightRef.current ? "inverted" : "normal");
  }

  function handleListLayout(event: LayoutChangeEvent) {
    listHeightRef.current = event.nativeEvent.layout.height;
    resolveListMode();
  }

  function handleContentSizeChange(_width: number, height: number) {
    contentHeightRef.current = height;
    resolveListMode();
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (listMode === "measure") {
      return;
    }
    if (event.nativeEvent.contentOffset.y > 8) {
      userScrolledRef.current = true;
    }
    if (!useInvertedList && event.nativeEvent.contentOffset.y <= 24) {
      void loadOlderMessages();
    }
  }

  async function submit() {
    if (!session) {
      onRequireAuth();
      return;
    }
    const text = body.trim();
    if (!text) return;
    try {
      const created = await sendMessage(
        session.accessToken,
        conversationId,
        text,
      );
      setMessages((current) => [...current, created]);
      requestAnimationFrame(() => {
        if (useInvertedList) {
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
        } else {
          listRef.current?.scrollToEnd({ animated: false });
        }
      });
      setBody("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发送失败");
    }
  }

  return (
    <View style={styles.chatScreen}>
      <View style={styles.chatHeader}>
        <Pressable style={styles.backButtonCompact} onPress={onBack}>
          <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
        </Pressable>
        <Text style={styles.chatTitle}>{partnerName}</Text>
        {/* <Text style={styles.chatSubtitle}>与 @{partnerId} 的对话</Text> */}
      </View>

      <FlatList
        key={listMode}
        ref={listRef}
        style={[styles.chatList, { opacity: listMode === "measure" ? 0 : 1 }]}
        contentContainerStyle={styles.chatListContent}
        data={visibleMessages}
        inverted={useInvertedList}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => {
          const previousMessage = useInvertedList
            ? visibleMessages[index + 1]
            : visibleMessages[index - 1];
          const showTime =
            !previousMessage ||
            !sameMinute(previousMessage.created_at, item.created_at);
          const bubble = (
            <View
              style={[
                styles.messageBubble,
                item.sender.id === session?.user.id
                  ? styles.messageBubbleMine
                  : styles.messageBubbleOther,
              ]}
            >
              <Text style={styles.messageBubbleText}>{item.body}</Text>
            </View>
          );
          const time = showTime ? (
            <Text style={styles.chatTimeDivider}>
              {formatDateTimeMinute(item.created_at)}
            </Text>
          ) : null;
          return (
            <>
              {useInvertedList ? bubble : time}
              {useInvertedList ? time : bubble}
            </>
          );
        }}
        onEndReached={useInvertedList ? loadOlderMessages : undefined}
        onEndReachedThreshold={0.2}
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleListLayout}
        onScroll={handleScroll}
        scrollEventThrottle={80}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.chatComposerBar}>
        <TextInput
          style={styles.chatComposerInput}
          multiline
          placeholder={t("输入消息...")}
          placeholderTextColor={colors.textSubtle}
          value={body}
          onChangeText={setBody}
        />

        <Pressable style={styles.chatSendButton} onPress={submit}>
          <Text style={styles.primaryButtonText}>{t("发送")}</Text>
        </Pressable>
      </View>
      {message ? (
        <Text
          style={[
            styles.authApiHint,
            styles.chatComposerHint,
            { color: colors.primaryText },
          ]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
