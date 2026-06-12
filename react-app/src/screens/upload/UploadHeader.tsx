import { Pressable, Text, View } from "react-native";

import type { AppStyles } from "../../components/styles";

type UploadHeaderProps = {
  onCancel: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function UploadHeader({ onCancel, styles, t }: UploadHeaderProps) {
  return (
    <View style={styles.pageHeaderRow}>
      <Pressable style={styles.backButtonCompact} onPress={onCancel}>
        <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
      </Pressable>
      <Text style={styles.pageTitle}>{t("发布博客")}</Text>
    </View>
  );
}
