import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { CommentItem as CommentItemType } from "../../services/commentsApi";
import { formatDateTimeMinute } from "../../utils/time";
import { useAppTheme } from "../../theme/ThemeProvider";
import type { FlatCommentItem } from "./hooks/useCommentLoad";

type CommentItemProps = {
  item: FlatCommentItem;
  isHighlighted: boolean;
  isExpanded: boolean;
  visibleTranslatedComments: Set<number>;
  translatedComments: Record<number, string>;
  translatingCommentId: number | null;
  commentsById: Map<number, CommentItemType>;
  onLayout: (commentId: number, event: any) => void;
  onToggleLike: (comment: CommentItemType) => void;
  onStartReply: (comment: CommentItemType) => void;
  onToggleRoot: (commentId: number) => void;
  onRemoveComment: (comment: CommentItemType) => void;
  onToggleTranslation: (comment: CommentItemType) => void;
  canDelete: (comment: CommentItemType) => boolean;
};

export function CommentItem({
  item,
  isHighlighted,
  isExpanded,
  visibleTranslatedComments,
  translatedComments,
  translatingCommentId,
  commentsById,
  onLayout,
  onToggleLike,
  onStartReply,
  onToggleRoot,
  onRemoveComment,
  onToggleTranslation,
  canDelete,
}: CommentItemProps) {
  const { colors, styles } = useAppTheme();
  const { t } = useTranslation();
  const comment = item.comment;
  const isReply = item.type === "reply";
  const replyTarget = comment.parent_id
    ? commentsById.get(comment.parent_id)
    : null;

  return (
    <View
      style={[styles.commentThread, isReply && styles.commentReplyThread]}
      onLayout={(event) => onLayout(comment.id, event)}
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
        <Text style={styles.commentBody}>
          {visibleTranslatedComments.has(comment.id) &&
          translatedComments[comment.id]
            ? translatedComments[comment.id]
            : comment.body}
        </Text>
        <Pressable
          style={styles.translationInlineAction}
          onPress={() => onToggleTranslation(comment)}
          disabled={translatingCommentId === comment.id}
        >
          <Text style={styles.translationInlineText}>
            {translatingCommentId === comment.id
              ? t("翻译中...")
              : visibleTranslatedComments.has(comment.id)
                ? t("查看原文")
                : t("查看译文")}
          </Text>
        </Pressable>
        <View style={styles.compactActionRow}>
          <Pressable
            style={styles.compactActionButton}
            onPress={() => onToggleLike(comment)}
          >
            <Ionicons
              name={comment.is_liked ? "heart" : "heart-outline"}
              size={14}
              color={comment.is_liked ? colors.danger : colors.primaryText}
            />
            <Text style={styles.compactActionText}>
              {" "}
              {comment.like_count}
            </Text>
          </Pressable>
          <Pressable
            style={styles.compactActionButton}
            onPress={() => onStartReply(comment)}
          >
            <Text style={styles.compactActionText}>{t("回复")}</Text>
          </Pressable>
          {!isReply && item.replyCount > 0 ? (
            <Pressable
              style={styles.compactActionButton}
              onPress={() => onToggleRoot(comment.id)}
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
              onPress={() => onRemoveComment(comment)}
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
