import { Pressable, Text } from "react-native";

import type { AppStyles } from "../../components/styles";
import type { CreatePostPayload } from "../../services/postApi";

type PublishActionsProps = {
  isSubmitting: boolean;
  onSubmit: (status: CreatePostPayload["status"]) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function PublishActions({
  isSubmitting,
  onSubmit,
  styles,
  t,
}: PublishActionsProps) {
  return (
    <>
      <Pressable
        style={[styles.primaryButton, isSubmitting && { opacity: 0.65 }]}
        onPress={() => onSubmit("published")}
        disabled={isSubmitting}
      >
        <Text style={styles.primaryButtonText}>
          {isSubmitting ? t("提交中...") : t("上传")}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.draftButton, isSubmitting && { opacity: 0.65 }]}
        onPress={() => onSubmit("draft")}
        disabled={isSubmitting}
      >
        <Text style={styles.draftButtonText}>{t("保存草稿")}</Text>
      </Pressable>
    </>
  );
}
