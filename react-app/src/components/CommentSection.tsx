import { useEffect, useRef, useCallback, useState } from "react";
import {
  FlatList,
  Platform,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useScrollItemAboveKeyboard } from "../hooks/useScrollItemAboveKeyboard";
import type { AuthSession } from "../services/authSession";
import type { CommentItem as CommentItemType } from "../services/commentsApi";
import { useAuthStore } from "../stores/authStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../theme/ThemeProvider";
import {
  useCommentLoad,
  type FlatCommentItem,
} from "./comment/hooks/useCommentLoad";
import { useCommentFocus } from "./comment/hooks/useCommentFocus";
import { useCommentActions } from "./comment/hooks/useCommentActions";
import { useCommentComposer } from "./comment/hooks/useCommentComposer";
import { useCommentTranslation } from "./comment/hooks/useCommentTranslation";
import { CommentItem } from "./comment/CommentItem";
import { CommentComposer } from "./comment/CommentComposer";

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
  const { colors, styles } = useAppTheme();
  const storeSession = useAuthStore((state) => state.session);
  const requireAuthSession = useAuthStore((state) => state.requireSession);
  const unreadCount = useNotificationStore(
    (state) => state.unreadByPostId[postId] || 0,
  );
  const markPostRead = useNotificationStore((state) => state.markPostRead);
  const currentSession = storeSession ?? session;
  const { t } = useTranslation();

  const [expandedRoots, setExpandedRoots] = useState<Set<number>>(new Set());
  const [pendingReplyFocusId, setPendingReplyFocusId] = useState<
    number | null
  >(null);

  const {
    bottomAccessoryHeight: composerHeight,
    handleBottomAccessoryLayout,
    handleListLayout,
    keyboardInset,
    listRef,
    registerItemLayout,
    scrollItemAboveKeyboard,
  } = useScrollItemAboveKeyboard<FlatCommentItem>();

  const {
    comments,
    commentsById,
    flatComments,
    isLoading,
    message,
    hasScrolledToFocus,
    setComments,
    setMessage,
    setHasScrolledToFocus,
  } = useCommentLoad({
    postId,
    currentSession,
    onCommentCountChange,
    expandedRoots,
  });

  const { highlightedCommentId, setHighlightedCommentId } = useCommentFocus({
    focusCommentId,
    commentsById,
    flatComments,
    hasScrolledToFocus,
    keyboardInset,
    listRef,
    scrollItemAboveKeyboard,
    setExpandedRoots,
    setPendingReplyFocusId,
  });

  const {
    body,
    setBody,
    replyingTo,
    setReplyingTo,
    startReply,
    cancelReply,
  } = useCommentComposer({
    commentsById,
    setExpandedRoots,
    setPendingReplyFocusId,
  });

  const {
    submitComment,
    toggleLike,
    removeComment,
    canDelete,
    toggleRoot,
  } = useCommentActions({
    postId,
    currentSession,
    comments,
    commentsById,
    requireAuthSession,
    onRequireAuth,
    onCommentCountChange,
    setComments,
    setExpandedRoots,
    setReplyingTo,
    setBody,
    setMessage,
  });

  const {
    translatedComments,
    visibleTranslatedComments,
    translatingCommentId,
    toggleCommentTranslation,
  } = useCommentTranslation({
    currentSession,
    setMessage,
  });

  useEffect(() => {
    if (!currentSession) {
      return;
    }
    void markPostRead(currentSession, postId);
  }, [currentSession, markPostRead, postId]);

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
    setHighlightedCommentId,
  ]);

  const renderCommentItem = useCallback(
    ({ item }: { item: FlatCommentItem }) => (
      <CommentItem
        item={item}
        isHighlighted={highlightedCommentId === item.comment.id}
        isExpanded={expandedRoots.has(item.rootId)}
        visibleTranslatedComments={visibleTranslatedComments}
        translatedComments={translatedComments}
        translatingCommentId={translatingCommentId}
        commentsById={commentsById}
        onLayout={registerItemLayout}
        onToggleLike={toggleLike}
        onStartReply={startReply}
        onToggleRoot={toggleRoot}
        onRemoveComment={removeComment}
        onToggleTranslation={toggleCommentTranslation}
        canDelete={canDelete}
      />
    ),
    [
      highlightedCommentId,
      expandedRoots,
      visibleTranslatedComments,
      translatedComments,
      translatingCommentId,
      commentsById,
      registerItemLayout,
      toggleLike,
      startReply,
      toggleRoot,
      removeComment,
      toggleCommentTranslation,
      canDelete,
    ],
  );

  const ListHeader = useCallback(() => {
    return (
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
            <Text
              style={[styles.authApiHint, { color: colors.primaryText }]}
            >
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
    );
  }, [
    headerComponent,
    unreadCount,
    isLoading,
    message,
    flatComments.length,
    t,
    styles,
    colors.primaryText,
  ]);

  return (
    <View style={styles.commentScreenContainer}>
      <FlatList
        ref={listRef}
        style={styles.commentList}
        contentContainerStyle={[
          styles.pageContent,
          contentContainerStyle,
          bottomComposerEnabled && { paddingBottom: composerHeight + 24 },
        ]}
        data={flatComments}
        keyExtractor={(item) => item.id}
        renderItem={renderCommentItem}
        ListHeaderComponent={ListHeader}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={40}
        windowSize={9}
        removeClippedSubviews
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
        <CommentComposer
          replyingTo={replyingTo}
          body={body}
          onCancelReply={cancelReply}
          onSubmitComment={() => submitComment(replyingTo, body)}
          onBodyChange={setBody}
          bottomAccessory={bottomAccessory}
          onLayout={handleBottomAccessoryLayout}
        />
      ) : null}
    </View>
  );
}
