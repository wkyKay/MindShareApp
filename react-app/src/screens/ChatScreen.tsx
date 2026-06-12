import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useAuthStore } from "../stores/authStore";
import { useMessageStore } from "../stores/messageStore";
import type { Message } from "../services/messagesApi";
import { formatDateTimeMinute, sameMinute } from "../utils/time";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../theme/ThemeProvider";
import { useChatComposer } from "./chat/hooks/useChatComposer";
import { useChatMessages } from "./chat/hooks/useChatMessages";
import { useChatReadReceipt } from "./chat/hooks/useChatReadReceipt";

type ChatScreenProps = {
  conversationId: number;
  partnerId: number;
  partnerName: string;
  onBack: () => void;
  onRequireAuth: () => void;
};

type ChatMessageRowStyles = {
  chatTimeDivider: StyleProp<TextStyle>;
  messageBubble: StyleProp<ViewStyle>;
  messageBubbleMine: StyleProp<ViewStyle>;
  messageBubbleOther: StyleProp<ViewStyle>;
  messageBubbleText: StyleProp<TextStyle>;
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
  const [message, setMessage] = useState("");
  const { t } = useTranslation();
  const {
    appendMessage,
    handleContentSizeChange,
    handleScroll,
    isListReady,
    listRef,
    loadLatestMessages,
    messages,
  } = useChatMessages({
    conversationId,
    latestMessage,
    session,
    setMessage,
  });
  useChatReadReceipt({
    conversationId,
    loadLatestMessages,
    markConversationReadLocal,
    session,
  });
  const { body, setBody, submit } = useChatComposer({
    appendMessage,
    conversationId,
    onRequireAuth,
    session,
    setMessage,
  });

  const renderMessageItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const previousMessage = messages[index - 1];
      return (
        <ChatMessageRow
          item={item}
          previousMessage={previousMessage}
          isMine={item.sender.id === session?.user.id}
          styles={styles}
        />
      );
    },
    [messages, session?.user.id, styles],
  );

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
        ref={listRef}
        style={[styles.chatList, { opacity: isListReady ? 1 : 0 }]}
        contentContainerStyle={styles.chatListContent}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMessageItem}
        onContentSizeChange={handleContentSizeChange}
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

type ChatMessageRowProps = {
  item: Message;
  previousMessage?: Message;
  isMine: boolean;
  styles: ChatMessageRowStyles;
};

function ChatMessageRow({
  item,
  previousMessage,
  isMine,
  styles,
}: ChatMessageRowProps) {
  const showTime =
    !previousMessage || !sameMinute(previousMessage.created_at, item.created_at);
  const bubbleStyle = isMine
    ? [styles.messageBubble, styles.messageBubbleMine]
    : [styles.messageBubble, styles.messageBubbleOther];
  const bubble = (
    <View style={bubbleStyle}>
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
      {time}
      {bubble}
    </>
  );
}
