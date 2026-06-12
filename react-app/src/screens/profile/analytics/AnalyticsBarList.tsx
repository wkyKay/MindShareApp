import { Text, View, type DimensionValue } from "react-native";

import type { AppStyles } from "../../../components/styles";
import type { TagCount } from "./types";

type AnalyticsBarListProps = {
  title: string;
  emptyText: string;
  data: TagCount[];
  styles: AppStyles;
};

export function AnalyticsBarList({
  title,
  emptyText,
  data,
  styles,
}: AnalyticsBarListProps) {
  const maxCount = data[0]?.count || 0;

  return (
    <View style={styles.analyticsCard}>
      <Text style={styles.analyticsCardTitle}>{title}</Text>
      {data.length === 0 ? (
        <Text style={styles.analyticsEmptyText}>{emptyText}</Text>
      ) : (
        data.map((item) => {
          const width: DimensionValue =
            maxCount > 0
              ? `${Math.max(12, Math.round((item.count / maxCount) * 100))}%`
              : "0%";
          return (
            <View key={item.tag} style={styles.analyticsBarItem}>
              <View style={styles.analyticsBarLabelRow}>
                <Text style={styles.analyticsTagText}>#{item.tag}</Text>
                <Text style={styles.analyticsCountText}>{item.count}</Text>
              </View>
              <View style={styles.analyticsBarTrack}>
                <View style={[styles.analyticsBarFill, { width }]} />
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}
