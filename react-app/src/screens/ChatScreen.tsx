import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
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
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const { t } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      if (!session || !conversationId) return;
      void loadMessages();
      void markConversationRead(session.accessToken, conversationId);
      void markConversationReadLocal(session, conversationId);
    }, [conversationId, session]),
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
  }, [latestMessage]);

  async function loadMessages() {
    if (!session || !conversationId) return;
    try {
      const data = await listMessages(session.accessToken, conversationId);
      setMessages(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "消息加载失败");
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
        style={styles.chatList}
        contentContainerStyle={styles.chatListContent}
        data={invertedMessages}
        inverted
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => {
          const previousMessage = invertedMessages[index + 1];
          const showTime =
            !previousMessage ||
            !sameMinute(previousMessage.created_at, item.created_at);
          return (
            <>
              {showTime ? (
                <Text style={styles.chatTimeDivider}>
                  {formatDateTimeMinute(item.created_at)}
                </Text>
              ) : null}
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
            </>
          );
        }}
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
