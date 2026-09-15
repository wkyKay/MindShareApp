import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { StreamdownRN } from "streamdown-rn";

import { useTranslation } from "react-i18next";
import { createMarkdownTheme } from "../components/MarkdownText";
import { useApiErrorHandler } from "../hooks/useApiErrorHandler";
import {
  streamBlogAiChat,
  type AiChatRequestMessage,
  type BlogAiChatMode,
  type PostEditProposal,
} from "../services/aiChatApi";
import { getPost, updatePost, type PostDetail } from "../services/postApi";
import { useAuthStore } from "../stores/authStore";
import { useAppTheme } from "../theme/ThemeProvider";
import { PostEditProposalCard } from "./blog/PostEditProposalCard";

type BlogAiChatScreenProps = {
  postId: number;
  mode: BlogAiChatMode;
  onBack: () => void;
  onPostSaved?: (post: PostDetail) => void;
};

type PostEditProposalState = PostEditProposal & {
  status: "pending" | "saving" | "saved" | "cancelled";
};

type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error";
  postEditProposal?: PostEditProposalState;
  toolStatus?: string | null;
};

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function BlogAiChatScreen({
  postId,
  mode,
  onBack,
  onPostSaved,
}: BlogAiChatScreenProps) {
  const { colors, styles } = useAppTheme();
  const markdownTheme = useMemo(() => createMarkdownTheme(colors), [colors]);
  const { t } = useTranslation();
  const handleApiError = useApiErrorHandler();
  const session = useAuthStore((state) => state.session);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const listRef = useRef<FlatList<AiChatMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setLoadError("");
      try {
        const data = await getPost(postId);
        if (!cancelled) {
          setPost(data);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            handleApiError(error, { fallback: "博客加载失败，请稍后重试。" }),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [handleApiError, postId]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });
  }, []);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setMessages((current) =>
      current.map((item) =>
        item.status === "streaming" ? { ...item, status: "done" } : item,
      ),
    );
  }, []);

  const submit = useCallback(async () => {
    if (isStreaming) {
      stopStreaming();
      return;
    }
    if (!session) {
      setNotice(t("请先登录后再使用 AI 聊天。"));
      return;
    }
    if (!post) return;
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
      await streamBlogAiChat({
        accessToken: session.accessToken,
        postId: post.id,
        mode,
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
        onPostEditProposal(proposal) {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessage.id
                ? {
                    ...item,
                    postEditProposal: {
                      ...proposal,
                      status: "pending",
                    },
                  }
                : item,
            ),
          );
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
  }, [
    handleApiError,
    input,
    isStreaming,
    messages,
    mode,
    post,
    scrollToBottom,
    session,
    stopStreaming,
    t,
  ]);

  const handleConfirmEdit = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg?.postEditProposal || !session || !post) return;
      const proposal = msg.postEditProposal;

      setMessages((current) =>
        current.map((item) =>
          item.id === messageId && item.postEditProposal
            ? { ...item, postEditProposal: { ...item.postEditProposal, status: "saving" } }
            : item,
        ),
      );

      try {
        const nextTitle = proposal.title.trim();
        const nextBody = proposal.body.trim();
        const nextSummary = proposal.summary?.trim() || nextBody.slice(0, 120);

        await updatePost(post.id, {
          title: nextTitle,
          body: nextBody,
          summary: nextSummary,
        });

        const updated: PostDetail = {
          ...post,
          title: nextTitle,
          body: nextBody,
          summary: nextSummary,
        };

        setPost(updated);
        setMessages((current) =>
          current.map((item) =>
            item.id === messageId && item.postEditProposal
              ? { ...item, postEditProposal: { ...item.postEditProposal, status: "saved" } }
              : item,
          ),
        );
        setNotice(t("已保存修改。"));
        onPostSaved?.(updated);
      } catch (error) {
        const message = handleApiError(error, t("保存失败，请稍后重试。"));
        setNotice(message);
        setMessages((current) =>
          current.map((item) =>
            item.id === messageId && item.postEditProposal
              ? { ...item, postEditProposal: { ...item.postEditProposal, status: "pending" } }
              : item,
          ),
        );
      }
    },
    [handleApiError, messages, onPostSaved, post, session, t],
  );

  const handleCancelEdit = useCallback((messageId: string) => {
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId && item.postEditProposal
          ? { ...item, postEditProposal: { ...item.postEditProposal, status: "cancelled" } }
          : item,
      ),
    );
  }, []);

  const headerSubtitle = useMemo(() => {
    if (mode === "edit") {
      return t("可要求 AI 修改标题、摘要或正文，每次修改需你确认后保存。");
    }
    return t("基于这篇博客的内容进行提问和讨论。");
  }, [mode, t]);

  if (isLoading) {
    return (
      <View style={styles.chatScreen}>
        <View style={styles.chatHeader}>
          <Pressable style={{ alignSelf: "flex-start", marginBottom: 6 }} onPress={onBack}>
            <Text style={{ color: colors.primaryText, fontSize: 15, fontWeight: "800" }}>
              {t("‹ 返回")}
            </Text>
          </Pressable>
          <Text style={styles.chatTitle}>
            {mode === "edit" ? t("AI 博客编辑") : t("AI 博客解读")}
          </Text>
          <Text style={styles.chatSubtitle}>{t("加载中...")}</Text>
        </View>
      </View>
    );
  }

  if (!post || loadError) {
    return (
      <View style={styles.chatScreen}>
        <View style={styles.chatHeader}>
          <Pressable style={{ alignSelf: "flex-start", marginBottom: 6 }} onPress={onBack}>
            <Text style={{ color: colors.primaryText, fontSize: 15, fontWeight: "800" }}>
              {t("‹ 返回")}
            </Text>
          </Pressable>
          <Text style={styles.chatTitle}>
            {mode === "edit" ? t("AI 博客编辑") : t("AI 博客解读")}
          </Text>
        </View>
        <View style={[styles.pageContent, { flex: 1 }]}>
          <Text style={{ color: colors.textMuted }}>
            {loadError || t("博客加载失败，请稍后重试。")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.chatScreen, { paddingBottom: 0 }]}>
      <View style={styles.chatHeader}>
        <Pressable style={{ alignSelf: "flex-start", marginBottom: 6 }} onPress={onBack}>
          <Text style={{ color: colors.primaryText, fontSize: 15, fontWeight: "800" }}>
            {t("‹ 返回")}
          </Text>
        </Pressable>
        <Text style={styles.chatTitle}>
          {mode === "edit" ? t("AI 博客编辑") : t("AI 博客解读")}
        </Text>
        <Text style={styles.chatSubtitle}>{headerSubtitle}</Text>
        <Text
          style={{
            color: colors.textSubtle,
            fontSize: 12,
            marginTop: 6,
            fontWeight: "600",
          }}
          numberOfLines={1}
        >
          {t("博客：")}
          {post.title}
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
              <Text style={styles.aiChatTitle}>
                {mode === "edit" ? t("AI 编辑助手") : t("AI 解读助手")}
              </Text>
              <Text style={styles.aiChatDescription}>
                {mode === "edit"
                  ? t("告诉我你想怎么修改这篇博客，比如「帮我把第二段改得更简洁」。")
                  : t("输入问题开始对话，我会基于这篇博客的内容回答你。")}
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
                item.postEditProposal && item.role === "assistant"
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
            {item.role === "assistant" && item.postEditProposal ? (
              <PostEditProposalCard
                proposal={item.postEditProposal}
                post={post}
                onConfirm={() => void handleConfirmEdit(item.id)}
                onCancel={() => handleCancelEdit(item.id)}
              />
            ) : null}
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
