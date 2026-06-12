import { View } from "react-native";

import type { AppStyles } from "../../../components/styles";
import { AnalyticsMetric } from "./AnalyticsMetric";

type AnalyticsMetricGridProps = {
  postsCount: number;
  draftCount: number;
  favoritePostsCount: number;
  collectionsCount: number;
  styles: AppStyles;
  t: (key: string) => string;
};

export function AnalyticsMetricGrid({
  postsCount,
  draftCount,
  favoritePostsCount,
  collectionsCount,
  styles,
  t,
}: AnalyticsMetricGridProps) {
  return (
    <View style={styles.analyticsMetricGrid}>
      <AnalyticsMetric label={t("发布")} value={postsCount} styles={styles} />
      <AnalyticsMetric label={t("草稿")} value={draftCount} styles={styles} />
      <AnalyticsMetric
        label={t("收藏文章")}
        value={favoritePostsCount}
        styles={styles}
      />
      <AnalyticsMetric label={t("合集")} value={collectionsCount} styles={styles} />
    </View>
  );
}
