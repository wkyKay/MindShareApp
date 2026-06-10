import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";

import { useTranslation } from "react-i18next";
import { streamAiChat, type AiChatRequestMessage } from "../services/aiChatApi";
import { useAuthStore } from "../stores/authStore";
import { useAppTheme } from "../theme/ThemeProvider";

type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
};

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AiChatScreen() {
  const { colors, styles } = useAppTheme();
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const listRef = useRef<FlatList<AiChatMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }

  function stopStreaming() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages((current) =>
      current.map((item) =>
        item.status === "streaming" ? { ...item, status: "done" } : item,
      ),
    );
  }

  async function submit() {
    if (isStreaming) {
      stopStreaming();
      return;
    }
    if (!session) {
      setNotice(t("请先登录后再使用 AI 聊天。"));
      return;
    }
    const text = input.trim();
    if (!text) return;

    const userMessage: AiChatMessage = {
      id: createMessageId(),
      role: "user",
      content: text,
      status: "done",
    };
    const assistantMessage: AiChatMessage = {
      id: createMessageId(),
      role: "assistant",
      content: "",
      status: "streaming",
    };
    const nextMessages = [...messages, userMessage, assistantMessage];
    const requestMessages: AiChatRequestMessage[] = nextMessages
      .filter((item) => item.content.trim())
      .map((item) => ({ role: item.role, content: item.content }));

    setMessages(nextMessages);
    setInput("");
    setNotice("");
    setIsStreaming(true);
    scrollToBottom();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamAiChat({
        accessToken: session.accessToken,
        messages: requestMessages,
        signal: controller.signal,
        onDelta(delta) {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessage.id
                ? { ...item, content: item.content + delta }
                : item,
            ),
          );
          scrollToBottom();
        },
        onDone() {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessage.id ? { ...item, status: "done" } : item,
            ),
          );
        },
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : t("AI 回复失败，请稍后重试。");
      setNotice(message);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessage.id
            ? { ...item, content: item.content || message, status: "error" }
            : item,
        ),
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsStreaming(false);
    }
  }

  return (
    <View style={[styles.chatScreen, { paddingBottom: 0 }]}>
      <View style={styles.chatHeader}>
        <Text style={styles.chatTitle}>{t("AI 聊天")}</Text>
        <Text style={styles.chatSubtitle}>{t("发送问题后会通过 SSE 逐段返回 mock 回复。")}</Text>
      </View>

      <FlatList
        ref={listRef}
        style={styles.chatList}
        contentContainerStyle={styles.chatListContent}
        data={messages}
        keyExtractor={(item) => item.id}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        windowSize={7}
        onContentSizeChange={scrollToBottom}
        ListEmptyComponent={
          <View style={styles.aiChatPanel}>
            <View style={styles.aiChatIconBubble}>
              <Ionicons name="sparkles-outline" size={26} color={colors.primary} />
            </View>
            <View style={styles.aiChatTextBlock}>
              <Text style={styles.aiChatTitle}>{t("AI 助手")}</Text>
              <Text style={styles.aiChatDescription}>
                {t("输入任意问题，先用后端 mock 长句测试流式输出。")}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageBubble,
              item.role === "user" ? styles.messageBubbleMine : styles.messageBubbleOther,
            ]}
          >
            <Text style={styles.messageBubbleText}>
              {item.content || (item.status === "streaming" ? t("正在思考...") : "")}
            </Text>
          </View>
        )}
      />

      {notice ? <Text style={[styles.chatComposerHint, styles.messageCenterSubtitle]}>{notice}</Text> : null}

      <View style={styles.chatComposerBar}>
        <TextInput
          style={styles.chatComposerInput}
          value={input}
          onChangeText={setInput}
          placeholder={t("输入你的问题")}
          placeholderTextColor={colors.textSubtle}
          multiline
          editable={!isStreaming}
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={submit}
        />
        <Pressable
          style={[styles.chatSendButton, { opacity: input.trim() || isStreaming ? 1 : 0.5 }]}
          onPress={submit}
          disabled={!input.trim() && !isStreaming}
        >
          <Text style={styles.swipeDeleteText}>{isStreaming ? t("停止") : t("发送")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
