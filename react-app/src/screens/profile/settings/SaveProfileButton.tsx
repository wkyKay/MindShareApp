import { Pressable, Text } from "react-native";

import type { AppStyles } from "../../../components/styles";

type SaveProfileButtonProps = {
  isSubmitting: boolean;
  onSubmit: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function SaveProfileButton({
  isSubmitting,
  onSubmit,
  styles,
  t,
}: SaveProfileButtonProps) {
  return (
    <Pressable
      style={styles.primaryButton}
      onPress={onSubmit}
      disabled={isSubmitting}
    >
      <Text style={styles.primaryButtonText}>
        {isSubmitting ? t("保存中...") : t("保存修改")}
      </Text>
    </Pressable>
  );
}
