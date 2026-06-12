import { Pressable, Text, View } from "react-native";

import type { AppStyles } from "../../../components/styles";
import type { ProfilePost } from "../../../services/profileApi";

type AnalyticsTopPostsCardProps = {
  topPosts: ProfilePost[];
  onOpenPost: (postId: number) => void;
  styles: AppStyles;
  t: (key: string, options?: Record<string, string>) => string;
};

export function AnalyticsTopPostsCard({
  topPosts,
  onOpenPost,
  styles,
  t,
}: AnalyticsTopPostsCardProps) {
  return (
    <View style={styles.analyticsCard}>
      <Text style={styles.analyticsCardTitle}>{t("表现较好的内容")}</Text>
      {topPosts.length === 0 ? (
        <Text style={styles.analyticsEmptyText}>{t("还没有可分析的发布内容。")}</Text>
      ) : (
        topPosts.map((post) => (
          <Pressable
            key={post.id}
            style={styles.analyticsTopPostItem}
            onPress={() => onOpenPost(post.id)}
          >
            <Text style={styles.analyticsTopPostTitle}>{post.title}</Text>
            <Text style={styles.analyticsCountText}>
              {t("赞 {{likes}} · 评论 {{comments}} · 收藏 {{favorites}}", {
                likes: String(post.like_count),
                comments: String(post.comment_count),
                favorites: String(post.favorite_count),
              })}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}
