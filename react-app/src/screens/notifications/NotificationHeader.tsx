import { Pressable, Text, View } from "react-native";

import type { AppStyles } from "../../components/styles";

type NotificationHeaderProps = {
  title: string;
  onBack: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function NotificationHeader({
  title,
  onBack,
  styles,
  t,
}: NotificationHeaderProps) {
  return (
    <View style={styles.pageHeaderRow}>
      <Pressable style={styles.backButtonCompact} onPress={onBack}>
        <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
      </Pressable>
      <Text style={styles.pageTitle}>{title}</Text>
    </View>
  );
}
