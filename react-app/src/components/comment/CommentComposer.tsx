import { useRef } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { CommentItem } from "../../services/commentsApi";
import { useAppTheme } from "../../theme/ThemeProvider";

type CommentComposerProps = {
  replyingTo: CommentItem | null;
  body: string;
  onCancelReply: () => void;
  onSubmitComment: () => void;
  onBodyChange: (text: string) => void;
  bottomAccessory?: React.ReactElement | null;
  onLayout: (event: any) => void;
};

export function CommentComposer({
  replyingTo,
  body,
  onCancelReply,
  onSubmitComment,
  onBodyChange,
  bottomAccessory,
  onLayout,
}: CommentComposerProps) {
  const { colors, styles } = useAppTheme();
  const { t } = useTranslation();
  const composerRef = useRef<TextInput>(null);

  return (
    <View style={styles.blogBottomBarHost} onLayout={onLayout}>
      {replyingTo ? (
        <View style={styles.blogReplyTargetRow}>
          <Text style={styles.blogReplyTargetText}>
            {t("回复 {{name}}", {
              name: replyingTo.author?.display_name || "匿名用户",
            })}
          </Text>
          <Pressable onPress={onCancelReply}>
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
          placeholderTextColor={colors.textSubtle}
          value={body}
          onChangeText={onBodyChange}
          returnKeyType="send"
          onSubmitEditing={onSubmitComment}
        />
        {bottomAccessory}
      </View>
    </View>
  );
}
