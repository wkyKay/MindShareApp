import { Pressable, Text, View } from "react-native";

import type { AppStyles } from "../../../components/styles";

type AnalyticsHeaderProps = {
  onBack: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function AnalyticsHeader({ onBack, styles, t }: AnalyticsHeaderProps) {
  return (
    <View style={styles.pageHeaderRow}>
      <Pressable style={styles.backButtonCompact} onPress={onBack}>
        <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
      </Pressable>
      <Text style={styles.pageTitle}>{t("资料分析")}</Text>
    </View>
  );
}
