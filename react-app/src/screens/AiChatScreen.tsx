import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { StreamdownRN } from "streamdown-rn";

import { useTranslation } from "react-i18next";
import { createMarkdownTheme } from "../components/MarkdownText";
import { useApiErrorHandler } from "../hooks/useApiErrorHandler";
import {
  streamAiChat,
  type AiChatRequestMessage,
} from "../services/aiChatApi";
import { applyTheme } from "../services/themeApi";
import { useAuthStore } from "../stores/authStore";
import { useAppTheme, type PartialThemeColors } from "../theme/ThemeProvider";

type ThemeProposal = {
  theme: PartialThemeColors;
  description: string;
  status: "pending" | "applying" | "applied" | "cancelled";
};

type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
  themeProposal?: ThemeProposal;
  toolStatus?: string | null;
};

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// 需要展示预览的主要颜色键（按重要性排序）
const PREVIEW_COLOR_KEYS: Array<keyof PartialThemeColors> = [
  "primary",
  "background",
  "surface",
  "text",
  "textMuted",
  "border",
];

export function AiChatScreen() {
  const {
    colors,
    styles,
    resolvedMode,
    applyPreviewTheme,
    cancelPreviewTheme,
    previewTheme,
    setCustomTheme,
  } = useAppTheme();
  const markdownTheme = useMemo(() => createMarkdownTheme(colors), [colors]);
  const { t } = useTranslation();
  const handleApiError = useApiErrorHandler();
  const session = useAuthStore((state) => state.session);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const listRef = useRef<FlatList<AiChatMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 记录当前正在等待主题确认的消息 id，用于预览联动
  const pendingProposalIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // 组件卸载或切换出页面时，如果还在预览中则取消
  useEffect(() => {
    return () => {
      if (previewTheme) {
        cancelPreviewTheme();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
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

    // 如果之前有未确认的主题提议且还在预览中，发送新消息时取消预览
    if (previewTheme && pendingProposalIdRef.current) {
      cancelPreviewTheme();
      pendingProposalIdRef.current = null;
    }

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
        currentMode: resolvedMode,
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
        onThemeProposal(theme, description) {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessage.id
                ? {
                    ...item,
                    themeProposal: {
                      theme,
                      description,
                      status: "pending",
                    },
                  }
                : item,
            ),
          );
          pendingProposalIdRef.current = assistantMessage.id;
          scrollToBottom();
        },
        onToolStatus(tool, status, display) {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessage.id
                ? {
                    ...item,
                    toolStatus: status === "running" ? display || tool : null,
                  }
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
      const message = handleApiError(error, t("AI 回复失败，请稍后重试。"));
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

  async function handleConfirmTheme(messageId: string) {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.themeProposal || !session) return;

    setMessages((current) =>
      current.map((item) =>
        item.id === messageId && item.themeProposal
          ? { ...item, themeProposal: { ...item.themeProposal, status: "applying" } }
          : item,
      ),
    );

    try {
      const result = await applyTheme(
        session.accessToken,
        msg.themeProposal.theme,
        resolvedMode,
      );
      // 服务端保存成功后，更新本地自定义主题状态
      if (result[resolvedMode]) {
        await setCustomTheme(result[resolvedMode]!, resolvedMode);
      }
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId && item.themeProposal
            ? { ...item, themeProposal: { ...item.themeProposal, status: "applied" } }
            : item,
        ),
      );
      pendingProposalIdRef.current = null;
    } catch (error) {
      const message = handleApiError(error, t("保存主题失败，请稍后重试。"));
      setNotice(message);
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId && item.themeProposal
            ? { ...item, themeProposal: { ...item.themeProposal, status: "pending" } }
            : item,
        ),
      );
    }
  }

  function handlePreviewTheme(theme: PartialThemeColors, messageId: string) {
    applyPreviewTheme(theme);
    pendingProposalIdRef.current = messageId;
  }

  function handleCancelPreview(messageId: string) {
    cancelPreviewTheme();
    pendingProposalIdRef.current = null;
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId && item.themeProposal
          ? { ...item, themeProposal: { ...item.themeProposal, status: "cancelled" } }
          : item,
      ),
    );
  }

  const renderThemeProposalCard = (message: AiChatMessage) => {
    if (!message.themeProposal) return null;
    const { theme, description, status } = message.themeProposal;
    const isPreviewing =
      pendingProposalIdRef.current === message.id && !!previewTheme;

    const previewColors = PREVIEW_COLOR_KEYS.filter((key) => theme[key]);

    return (
      <View
        style={[
          styles.messageBubble,
          styles.messageBubbleOther as ViewStyle,
          {
            marginTop: 0,
            borderTopLeftRadius: 6,
            padding: 12,
            width: "82%",
            maxWidth: "82%",
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Ionicons name="color-palette-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
            {t("主题方案")}
          </Text>
        </View>

        <Text
          style={{
            color: colors.textMuted,
            fontSize: 13,
            lineHeight: 19,
            marginBottom: 12,
          }}
        >
          {description}
        </Text>

        {/* 颜色预览色块 */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {previewColors.slice(0, 6).map((key) => (
            <View key={key} style={{ alignItems: "center", gap: 4 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: theme[key],
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
              <Text style={{ color: colors.textSubtle, fontSize: 10 }}>{key}</Text>
            </View>
          ))}
        </View>

        {status === "pending" && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {!isPreviewing ? (
              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceSoft,
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                onPress={() => handlePreviewTheme(theme, message.id)}
              >
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                  {t("预览效果")}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 10,
                alignItems: "center",
              }}
              onPress={() => void handleConfirmTheme(message.id)}
            >
              <Text
                style={{
                  color: colors.surface,
                  fontSize: 14,
                  fontWeight: "700",
                }}
              >
                {t("确认应用")}
              </Text>
            </Pressable>
          </View>
        )}

        {status === "pending" && isPreviewing && (
          <Pressable
            style={{
              marginTop: 8,
              backgroundColor: "transparent",
              borderRadius: 12,
              paddingVertical: 8,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => handleCancelPreview(message.id)}
          >
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {t("取消预览")}
            </Text>
          </Pressable>
        )}

        {status === "applying" && (
          <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center" }}>
            {t("保存中...")}
          </Text>
        )}

        {status === "applied" && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
              {t("主题已应用")}
            </Text>
          </View>
        )}

        {status === "cancelled" && (
          <Text
            style={{
              color: colors.textSubtle,
              fontSize: 13,
              textAlign: "center",
            }}
          >
            {t("已取消")}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.chatScreen, { paddingBottom: 0 }]}>
      <View style={styles.chatHeader}>
        <Text style={styles.chatTitle}>{t("AI 聊天")}</Text>
        <Text style={styles.chatSubtitle}>
          {t("试试说「我想要蓝色主题」来定制你的专属配色")}
        </Text>
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
                {t("输入任意问题开始对话。也可以告诉我你想要的 App 颜色主题，比如「我想要绿色风格」。")}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View>
            {item.role === "assistant" && item.toolStatus ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingLeft: 4,
                  paddingBottom: 4,
                }}
              >
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {item.toolStatus}
                </Text>
              </View>
            ) : null}
            <View
              style={[
                styles.messageBubble,
                item.role === "user"
                  ? styles.messageBubbleMine
                  : styles.messageBubbleOther,
                item.themeProposal && item.role === "assistant"
                  ? { borderBottomLeftRadius: 6, marginBottom: 0 }
                  : null,
              ]}
            >
              {item.role === "assistant" && item.content.trim() ? (
                <StreamdownRN
                  theme={markdownTheme}
                  isComplete={item.status === "done"}
                  style={{ flex: 0 }}
                >
                  {item.content}
                </StreamdownRN>
              ) : (
                <Text style={styles.messageBubbleText}>
                  {item.content ||
                    (item.status === "streaming" ? t("正在思考...") : "")}
                </Text>
              )}
            </View>
            {item.role === "assistant" && item.themeProposal
              ? renderThemeProposalCard(item)
              : null}
          </View>
        )}
        keyboardShouldPersistTaps="handled"
      />

      {notice ? (
        <Text style={[styles.chatComposerHint, styles.messageCenterSubtitle]}>
          {notice}
        </Text>
      ) : null}

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
          <Text style={styles.swipeDeleteText}>
            {isStreaming ? t("停止") : t("发送")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
