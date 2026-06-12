import { Text, View } from "react-native";

import type { AppStyles } from "../../../components/styles";

type AnalyticsInsightCardProps = {
  authoredTopTag: string;
  favoritedTopTag: string;
  styles: AppStyles;
  t: (key: string, options?: Record<string, string>) => string;
};

export function AnalyticsInsightCard({
  authoredTopTag,
  favoritedTopTag,
  styles,
  t,
}: AnalyticsInsightCardProps) {
  return (
    <View style={styles.analyticsCard}>
      <Text style={styles.analyticsCardTitle}>{t("创作与收藏偏好")}</Text>
      <Text style={styles.analyticsInsightText}>
        {t("你最常发布：#{{tag}}", { tag: authoredTopTag })}
      </Text>
      <Text style={styles.analyticsInsightText}>
        {t("你最常收藏：#{{tag}}", { tag: favoritedTopTag })}
      </Text>
    </View>
  );
}
