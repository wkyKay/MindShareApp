import { Pressable, Text, View } from "react-native";

import { styles } from "../../components/styles";
import { useTranslation } from "react-i18next";

export type ProfileTab = "posts" | "favorites" | "collections" | "following";

type ProfileStatsProps = {
  activeTab: ProfileTab;
  postsCount: number;
  favoritesCount: number;
  collectionsCount: number;
  followingCount: number;
  postsBadgeCount?: number;
  onSelectTab: (tab: ProfileTab) => void;
};

export function ProfileStats({
  activeTab,
  postsCount,
  favoritesCount,
  collectionsCount,
  followingCount,
  postsBadgeCount = 0,
  onSelectTab,
}: ProfileStatsProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.profileStats}>
      <Pressable
        style={styles.profileStatItem}
        onPress={() => onSelectTab("posts")}
      >
        <View style={styles.profileStatLabelRow}>
          <Text style={styles.profileStatNumber}>{postsCount}</Text>
          {postsBadgeCount > 0 ? (
            <View style={styles.profileStatBadge} />
          ) : null}
        </View>
        <Text
          style={[
            styles.profileStatLabel,
            activeTab === "posts" && styles.segmentTextActive,
          ]}
        >
          {t("发布")}
        </Text>
      </Pressable>
      <Pressable
        style={styles.profileStatItem}
        onPress={() => onSelectTab("favorites")}
      >
        <Text style={styles.profileStatNumber}>{favoritesCount}</Text>
        <Text
          style={[
            styles.profileStatLabel,
            activeTab === "favorites" && styles.segmentTextActive,
          ]}
        >
          {t("收藏")}
        </Text>
      </Pressable>
      <Pressable
        style={styles.profileStatItem}
        onPress={() => onSelectTab("collections")}
      >
        <Text style={styles.profileStatNumber}>{collectionsCount}</Text>
        <Text
          style={[
            styles.profileStatLabel,
            activeTab === "collections" && styles.segmentTextActive,
          ]}
        >
          {t("合集")}
        </Text>
      </Pressable>
      <Pressable
        style={styles.profileStatItem}
        onPress={() => onSelectTab("following")}
      >
        <Text style={styles.profileStatNumber}>{followingCount}</Text>
        <Text
          style={[
            styles.profileStatLabel,
            activeTab === "following" && styles.segmentTextActive,
          ]}
        >
          {t("关注")}
        </Text>
      </Pressable>
    </View>
  );
}
