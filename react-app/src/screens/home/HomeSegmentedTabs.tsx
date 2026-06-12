import { Pressable, Text, View } from "react-native";

import type { AppStyles } from "../../components/styles";
import type { HomeSection } from "./hooks/useHomeTabs";

type HomeSegmentedTabsProps = {
  isDiscover: boolean;
  onChangeSection: (section: HomeSection) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function HomeSegmentedTabs({
  isDiscover,
  onChangeSection,
  styles,
  t,
}: HomeSegmentedTabsProps) {
  return (
    <View style={styles.segmentedControl}>
      <Pressable
        style={[styles.segmentButton, isDiscover && styles.segmentButtonActive]}
        onPress={() => onChangeSection("discover")}
      >
        <Text style={[styles.segmentText, isDiscover && styles.segmentTextActive]}>
          {t("发现")}
        </Text>
        <View
          style={[
            styles.segmentUnderline,
            isDiscover && styles.segmentUnderlineActive,
          ]}
        />
      </Pressable>
      <Pressable
        style={[styles.segmentButton, !isDiscover && styles.segmentButtonActive]}
        onPress={() => onChangeSection("following")}
      >
        <Text
          style={[styles.segmentText, !isDiscover && styles.segmentTextActive]}
        >
          {t("关注")}
        </Text>
        <View
          style={[
            styles.segmentUnderline,
            !isDiscover && styles.segmentUnderlineActive,
          ]}
        />
      </Pressable>
    </View>
  );
}
