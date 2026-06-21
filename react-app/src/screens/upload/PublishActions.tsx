import { Pressable, Text } from "react-native";

import type { AppStyles } from "../../components/styles";
import type { CreatePostPayload } from "../../services/postApi";

type PublishActionsProps = {
  isSubmitting: boolean;
  bodyExceeded: boolean;
  onSubmit: (status: CreatePostPayload["status"]) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function PublishActions({
  isSubmitting,
  bodyExceeded,
  onSubmit,
  styles,
  t,
}: PublishActionsProps) {
  const disabled = isSubmitting || bodyExceeded;

  return (
    <>
      <Pressable
        style={[styles.primaryButton, disabled && { opacity: 0.65 }]}
        onPress={() => onSubmit("published")}
        disabled={disabled}
      >
        <Text style={styles.primaryButtonText}>
          {isSubmitting ? t("提交中...") : t("上传")}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.draftButton, disabled && { opacity: 0.65 }]}
        onPress={() => onSubmit("draft")}
        disabled={disabled}
      >
        <Text style={styles.draftButtonText}>{t("保存草稿")}</Text>
      </Pressable>
    </>
  );
}
