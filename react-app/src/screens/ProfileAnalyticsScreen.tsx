import { ScrollView } from "react-native";

import { useAuthStore } from "../stores/authStore";
import { useTranslation } from "react-i18next";
import { useAppStyles } from "../theme/ThemeProvider";
import { AnalyticsBarList } from "./profile/analytics/AnalyticsBarList";
import { AnalyticsEngagementCard } from "./profile/analytics/AnalyticsEngagementCard";
import { AnalyticsHeader } from "./profile/analytics/AnalyticsHeader";
import { AnalyticsInsightCard } from "./profile/analytics/AnalyticsInsightCard";
import { AnalyticsMetricGrid } from "./profile/analytics/AnalyticsMetricGrid";
import { AnalyticsStatus } from "./profile/analytics/AnalyticsStatus";
import { AnalyticsTopPostsCard } from "./profile/analytics/AnalyticsTopPostsCard";
import { useProfileAnalytics } from "./profile/analytics/hooks/useProfileAnalytics";

type ProfileAnalyticsScreenProps = {
  onBack: () => void;
  onOpenAuth: () => void;
  onOpenPost: (postId: number) => void;
};

export function ProfileAnalyticsScreen({
  onBack,
  onOpenAuth,
  onOpenPost,
}: ProfileAnalyticsScreenProps) {
  const styles = useAppStyles();
  const session = useAuthStore((state) => state.session);
  const requireAuthSession = useAuthStore((state) => state.requireSession);
  const { t } = useTranslation();
  const analytics = useProfileAnalytics({ session, requireAuthSession });

  return (
    <ScrollView
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <AnalyticsHeader onBack={onBack} styles={styles} t={t} />

      <AnalyticsStatus
        isAuthenticated={!!session}
        isLoading={analytics.isLoading}
        message={analytics.message}
        onOpenAuth={onOpenAuth}
        styles={styles}
        t={t}
      />

      <AnalyticsMetricGrid
        postsCount={analytics.postsCount}
        draftCount={analytics.draftCount}
        favoritePostsCount={analytics.favoritePostsCount}
        collectionsCount={analytics.collectionsCount}
        styles={styles}
        t={t}
      />

      <AnalyticsEngagementCard
        totalLikes={analytics.totalLikes}
        totalComments={analytics.totalComments}
        totalFavorites={analytics.totalFavorites}
        styles={styles}
        t={t}
      />

      <AnalyticsBarList
        title={t("我的发布 Tag 分布")}
        emptyText={t("发布内容还没有标签。")}
        data={analytics.authoredTags}
        styles={styles}
      />

      <AnalyticsBarList
        title={t("我的收藏 Tag 分布")}
        emptyText={t("收藏文章还没有标签。")}
        data={analytics.favoritedTags}
        styles={styles}
      />

      <AnalyticsInsightCard
        authoredTopTag={analytics.authoredTopTag}
        favoritedTopTag={analytics.favoritedTopTag}
        styles={styles}
        t={t}
      />

      <AnalyticsTopPostsCard
        topPosts={analytics.topPosts}
        onOpenPost={onOpenPost}
        styles={styles}
        t={t}
      />
    </ScrollView>
  );
}
