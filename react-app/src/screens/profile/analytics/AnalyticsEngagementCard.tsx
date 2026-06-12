import { Text, View } from "react-native";

import type { AppStyles } from "../../../components/styles";
import { AnalyticsMetric } from "./AnalyticsMetric";

type AnalyticsEngagementCardProps = {
  totalLikes: number;
  totalComments: number;
  totalFavorites: number;
  styles: AppStyles;
  t: (key: string) => string;
};

export function AnalyticsEngagementCard({
  totalLikes,
  totalComments,
  totalFavorites,
  styles,
  t,
}: AnalyticsEngagementCardProps) {
  return (
    <View style={styles.analyticsCard}>
      <Text style={styles.analyticsCardTitle}>{t("互动总览")}</Text>
      <View style={styles.analyticsMetricGridCompact}>
        <AnalyticsMetric label={t("获赞")} value={totalLikes} compact styles={styles} />
        <AnalyticsMetric
          label={t("评论")}
          value={totalComments}
          compact
          styles={styles}
        />
        <AnalyticsMetric
          label={t("被收藏")}
          value={totalFavorites}
          compact
          styles={styles}
        />
      </View>
    </View>
  );
}
