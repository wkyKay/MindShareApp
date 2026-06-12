import { Text, View } from "react-native";

import type { AppStyles } from "../../../components/styles";

type AnalyticsMetricProps = {
  label: string;
  value: number | string;
  compact?: boolean;
  styles: AppStyles;
};

export function AnalyticsMetric({
  label,
  value,
  compact = false,
  styles,
}: AnalyticsMetricProps) {
  return (
    <View
      style={
        compact ? styles.analyticsMetricItemCompact : styles.analyticsMetricItem
      }
    >
      <Text style={styles.analyticsMetricValue}>{value}</Text>
      <Text style={styles.analyticsMetricLabel}>{label}</Text>
    </View>
  );
}
