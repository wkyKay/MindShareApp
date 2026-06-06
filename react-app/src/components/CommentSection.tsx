import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useScrollItemAboveKeyboard } from "../hooks/useScrollItemAboveKeyboard";
import type { AuthSession } from "../services/authSession";
import {
  createComment,
  deleteComment,
  getComments,
  setCommentLiked,
  type CommentItem,
} from "../services/commentsApi";
import { useAuthStore } from "../stores/authStore";
import { useNotificationStore } from "../stores/notificationStore";
import { formatDateTimeMinute } from "../utils/time";
import { styles } from "./styles";
import { useTranslation } from "react-i18next";

type CommentSectionProps = {
  postId: number;
  session?: AuthSession | null;
  focusCommentId?: number;
  headerComponent?: React.ReactElement | null;
  bottomAccessory?: React.ReactElement | null;
  bottomComposerEnabled?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onRequireAuth: () => void;
  onCommentCountChange: (count: number) => void;
};

type FlatCommentItem = {
  id: string;
  type: "root" | "reply";
  comment: CommentItem;
  rootId: number;
  replyCount: number;
};

export function CommentSection({
  postId,
  session,
  focusCommentId,
  headerComponent = null,
  bottomAccessory = null,
  bottomComposerEnabled = true,
  contentContainerStyle,
  onRequireAuth,
  onCommentCountChange,
}: CommentSectionProps) {
  const storeSession = useAuthStore((state) => state.session);
  const requireAuthSession = useAuthStore((state) => state.requireSession);
  const unreadCount = useNotificationStore(
    (state) => state.unreadByPostId[postId] || 0,
  );
  const markPostRead = useNotificationStore((state) => state.markPostRead);
  const currentSession = storeSession ?? session;
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<CommentItem | null>(null);
  const [expandedRoots, setExpandedRoots] = useState<Set<number>>(new Set());
  const [highlightedCommentId, setHighlightedCommentId] = useState<
    number | null
  >(null);
  const [hasScrolledToFocus, setHasScrolledToFocus] = useState(false);
  const [pendingReplyFocusId, setPendingReplyFocusId] = useState<number | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const composerRef = useRef<TextInput>(null);
  const {
    bottomAccessoryHeight: composerHeight,
    handleBottomAccessoryLayout,
    handleListLayout,
    keyboardInset,
    listRef,
    registerItemLayout,
    scrollItemAboveKeyboard,
  } = useScrollItemAboveKeyboard<FlatCommentItem>();
  const { t } = useTranslation();

  useEffect(() => {
    let isMounted = true;
    const accessToken = currentSession?.accessToken;
    async function loadComments() {
      setIsLoading(true);
      setMessage("");
      setHasScrolledToFocus(false);
      try {
        const data = await getComments(postId, accessToken);
        if (isMounted) {
          setComments(data.items);
          onCommentCountChange(data.total);
        }
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "评论加载失败。");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    void loadComments();
    return () => {
      isMounted = false;
    };
  }, [currentSession?.accessToken, onCommentCountChange, postId]);

  useEffect(() => {
    if (!currentSession) {
      return;
    }
    void markPostRead(currentSession, postId);
  }, [currentSession, markPostRead, postId]);

  const commentsById = useMemo(
    () => new Map(comments.map((comment) => [comment.id, comment])),
    [comments],
  );

  const { roots, repliesByRoot } = useMemo(() => {
    const replyMap = new Map<number, CommentItem[]>();
    const rootItems: CommentItem[] = [];

    for (const comment of comments) {
      if (comment.parent_id) {
        const rootId = findRootId(comment, commentsById);
        replyMap.set(rootId, [...(replyMap.get(rootId) || []), comment]);
      } else {
        rootItems.push(comment);
      }
    }

    return { roots: rootItems, repliesByRoot: replyMap };
  }, [comments, commentsById]);

  const flatComments = useMemo(() => {
    const items: FlatCommentItem[] = [];
    for (const root of roots) {
      const replies = repliesByRoot.get(root.id) || [];
      items.push({
        id: `root-${root.id}`,
        type: "root",
        comment: root,
        rootId: root.id,
        replyCount: replies.length,
      });
      if (expandedRoots.has(root.id)) {
        for (const reply of replies) {
          items.push({
            id: `reply-${reply.id}`,
            type: "reply",
            comment: reply,
            rootId: root.id,
            replyCount: 0,
          });
        }
      }
    }
    return items;
  }, [expandedRoots, repliesByRoot, roots]);

  useEffect(() => {
    if (!focusCommentId || !commentsById.has(focusCommentId)) {
      return;
    }
    const focusComment = commentsById.get(focusCommentId)!;
    const rootId = findRootId(focusComment, commentsById);
    setExpandedRoots((current) => {
      if (current.has(rootId)) {
        return current;
      }
      const next = new Set(current);
      next.add(rootId);
      return next;
    });
  }, [commentsById, focusCommentId]);

  useEffect(() => {
    if (!focusCommentId || hasScrolledToFocus || !flatComments.length) {
      return;
    }
    const targetIndex = flatComments.findIndex(
      (item) => item.comment.id === focusCommentId,
    );
    if (targetIndex < 0) {
      return;
    }
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: targetIndex,
        animated: true,
        viewPosition: 0.28,
      });
      setHighlightedCommentId(focusCommentId);
      setHasScrolledToFocus(true);
    }, 80);
    return () => clearTimeout(timer);
  }, [flatComments, focusCommentId, hasScrolledToFocus]);

  useEffect(() => {
    if (!highlightedCommentId) {
      return;
    }
    const timer = setTimeout(() => setHighlightedCommentId(null), 1800);
    return () => clearTimeout(timer);
  }, [highlightedCommentId]);

  useEffect(() => {
    if (!pendingReplyFocusId || !flatComments.length) {
      return;
    }
    const targetIndex = flatComments.findIndex(
      (item) => item.comment.id === pendingReplyFocusId,
    );
    if (targetIndex < 0) {
      return;
    }
    composerRef.current?.focus();

    const delays =
      keyboardInset > 0 || Platform.OS === "web" ? [80] : [120, 320];
    const timers = delays.map((delay) =>
      setTimeout(() => {
        scrollItemAboveKeyboard(pendingReplyFocusId, {
          fallbackIndex: targetIndex,
        });
        setHighlightedCommentId(pendingReplyFocusId);
        if (keyboardInset > 0 || Platform.OS === "web" || delay === 320) {
          setPendingReplyFocusId(null);
        }
      }, delay),
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [
    flatComments,
    keyboardInset,
    pendingReplyFocusId,
    scrollItemAboveKeyboard,
  ]);

  async function requireSession() {
    const activeSession = await requireAuthSession();
    if (!activeSession) {
      onRequireAuth();
      return null;
    }
    return activeSession;
  }

  async function submitComment(parent?: CommentItem) {
    const target = parent ?? replyingTo;
    const text = body.trim();
    if (!text) {
      setMessage("评论不能为空。");
      return;
    }
    const activeSession = await requireSession();
    if (!activeSession) return;
    setMessage("");
    try {
      const created = await createComment(
        postId,
        text,
        activeSession.accessToken,
        target?.id,
      );
      setComments((current) => [...current, created]);
      onCommentCountChange(comments.length + 1);
      if (target) {
        const rootId = findRootId(target, commentsById);
        setExpandedRoots((current) => new Set(current).add(rootId));
        setReplyingTo(null);
      }
      setBody("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "评论发布失败。");
    }
  }

  async function toggleLike(comment: CommentItem) {
    const activeSession = await requireSession();
    if (!activeSession) return;
    try {
      const data = await setCommentLiked(
        comment.id,
        !comment.is_liked,
        activeSession.accessToken,
      );
      setComments((current) =>
        current.map((item) =>
          item.id === comment.id
            ? { ...item, is_liked: data.liked, like_count: data.like_count }
            : item,
        ),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "评论点赞失败。");
    }
  }

  async function removeComment(comment: CommentItem) {
    const activeSession = await requireSession();
    if (!activeSession) return;
    try {
      await deleteComment(comment.id, activeSession.accessToken);
      const deletedIds = comment.parent_id
        ? new Set<number>([comment.id])
        : collectDeletedIds(comment.id, comments);
      setComments((current) =>
        current
          .map((item) =>
            comment.parent_id && item.parent_id === comment.id
              ? { ...item, parent_id: comment.parent_id }
              : item,
          )
          .filter((item) => !deletedIds.has(item.id)),
      );
      onCommentCountChange(Math.max(0, comments.length - deletedIds.size));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "评论删除失败。");
    }
  }

  function canDelete(comment: CommentItem) {
    return currentSession?.user.id === comment.author?.id;
  }

  function toggleRoot(rootId: number) {
    setExpandedRoots((current) => {
      const next = new Set(current);
      if (next.has(rootId)) {
        next.delete(rootId);
      } else {
        next.add(rootId);
      }
      return next;
    });
  }

  function startReply(comment: CommentItem) {
    const rootId = findRootId(comment, commentsById);
    setReplyingTo(comment);
    setBody("");
    setExpandedRoots((current) => new Set(current).add(rootId));
    setPendingReplyFocusId(comment.id);
  }

  function cancelReply() {
    setReplyingTo(null);
    setBody("");
    composerRef.current?.blur();
  }

  function renderCommentItem({ item }: { item: FlatCommentItem }) {
    const comment = item.comment;
    const isReply = item.type === "reply";
    const isExpanded = expandedRoots.has(item.rootId);
    const replyTarget = comment.parent_id
      ? commentsById.get(comment.parent_id)
      : null;
    const isHighlighted = highlightedCommentId === comment.id;

    return (
      <View
        style={[styles.commentThread, isReply && styles.commentReplyThread]}
        onLayout={(event) => registerItemLayout(comment.id, event)}
      >
        <View
          style={[
            styles.commentCard,
            isReply && styles.commentReplyCard,
            isHighlighted && styles.commentFocusedCard,
          ]}
        >
          <View style={styles.commentHeader}>
            <Text style={styles.cardAuthor}>
              {comment.author?.display_name || "匿名用户"}
              {replyTarget
                ? ` ${t("回复 {{name}}", { name: replyTarget.author?.display_name || "匿名用户" })}`
                : ""}
            </Text>
            <Text style={styles.cardMeta}>
              {formatDateTimeMinute(comment.created_at)}
            </Text>
          </View>
          <Text style={styles.commentBody}>{comment.body}</Text>
          <View style={styles.compactActionRow}>
            <Pressable
              style={styles.compactActionButton}
              onPress={() => toggleLike(comment)}
            >
              <Ionicons
                name={comment.is_liked ? "heart" : "heart-outline"}
                size={14}
                color={comment.is_liked ? "#e74c3c" : "#a05d6f"}
              />

              <Text style={styles.compactActionText}>
                {" "}
                {comment.like_count}
              </Text>
            </Pressable>
            <Pressable
              style={styles.compactActionButton}
              onPress={() => startReply(comment)}
            >
              <Text style={styles.compactActionText}>{t("回复")}</Text>
            </Pressable>
            {!isReply && item.replyCount > 0 ? (
              <Pressable
                style={styles.compactActionButton}
                onPress={() => toggleRoot(comment.id)}
              >
                <Text style={styles.compactActionText}>
                  {isExpanded
                    ? t("收起回复")
                    : t("展开 {{count}} 条回复", { count: item.replyCount })}
                </Text>
              </Pressable>
            ) : null}
            {canDelete(comment) ? (
              <Pressable
                style={[styles.compactActionButton, styles.compactDangerButton]}
                onPress={() => removeComment(comment)}
              >
                <Text
                  style={[styles.compactActionText, styles.compactDangerText]}
                >
                  {t("删除")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.commentScreenContainer}>
      <FlatList
        ref={listRef}
        contentContainerStyle={[
          styles.pageContent,
          contentContainerStyle,
          bottomComposerEnabled && { paddingBottom: composerHeight + 24 },
        ]}
        data={flatComments}
        keyExtractor={(item) => item.id}
        renderItem={renderCommentItem}
        ListHeaderComponent={
          <>
            {headerComponent}
            <View style={styles.commentSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>{t("评论区")}</Text>
                {unreadCount > 0 ? (
                  <View style={styles.cardNotificationDot} />
                ) : null}
              </View>
              {unreadCount > 0 ? (
                <Text style={styles.commentNotificationHint}>
                  {t("有新的评论或回复")}
                </Text>
              ) : null}
              {isLoading ? (
                <Text style={styles.profileBio}>{t("正在加载评论...")}</Text>
              ) : null}
              {message ? (
                <Text style={[styles.authApiHint, { color: "#a05d6f" }]}>
                  {message}
                </Text>
              ) : null}
              {!isLoading && flatComments.length === 0 ? (
                <Text style={styles.profileBio}>
                  {t("暂无评论，来抢第一条。")}
                </Text>
              ) : null}
            </View>
          </>
        }
        showsVerticalScrollIndicator={false}
        onLayout={handleListLayout}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(
            () =>
              listRef.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.28,
              }),
            120,
          );
        }}
      />

      {bottomComposerEnabled ? (
        <View
          style={styles.blogBottomBarHost}
          onLayout={handleBottomAccessoryLayout}
        >
          {replyingTo ? (
            <View style={styles.blogReplyTargetRow}>
              <Text style={styles.blogReplyTargetText}>
                {t("回复 {{name}}", {
                  name: replyingTo.author?.display_name || "匿名用户",
                })}
              </Text>
              <Pressable onPress={cancelReply}>
                <Text style={styles.blogReplyCancelText}>{t("取消")}</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.blogBottomBar}>
            <TextInput
              ref={composerRef}
              style={styles.blogBottomCommentInput}
              placeholder={
                replyingTo
                  ? t("回复 {{name}}...", {
                      name: replyingTo.author?.display_name || "评论",
                    })
                  : t("说点什么...")
              }
              placeholderTextColor="#a89994"
              value={body}
              onChangeText={setBody}
              returnKeyType="send"
              onSubmitEditing={() => submitComment()}
            />

            {bottomAccessory}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function findRootId(
  comment: CommentItem,
  commentsById: Map<number, CommentItem>,
) {
  let current = comment;
  while (current.parent_id && commentsById.has(current.parent_id)) {
    const parent = commentsById.get(current.parent_id)!;
    if (!parent.parent_id) {
      return parent.id;
    }
    current = parent;
  }
  return current.parent_id || current.id;
}

function collectDeletedIds(commentId: number, comments: CommentItem[]) {
  const deletedIds = new Set<number>([commentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const comment of comments) {
      if (
        comment.parent_id &&
        deletedIds.has(comment.parent_id) &&
        !deletedIds.has(comment.id)
      ) {
        deletedIds.add(comment.id);
        changed = true;
      }
    }
  }
  return deletedIds;
}
