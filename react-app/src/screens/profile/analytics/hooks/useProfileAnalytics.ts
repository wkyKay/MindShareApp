import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { useApiErrorHandler } from "../../../../hooks/useApiErrorHandler";
import {
  getMyCollections,
  getMyFavorites,
  getMyPosts,
  type FavoritePost,
  type ProfileFavorite,
  type ProfilePost,
} from "../../../../services/profileApi";
import type { AuthSession } from "../../../../services/authSession";
import type { TagCount } from "../types";

type UseProfileAnalyticsOptions = {
  session: AuthSession | null;
  requireAuthSession: () => Promise<AuthSession | null>;
};

export function useProfileAnalytics({
  session,
  requireAuthSession,
}: UseProfileAnalyticsOptions) {
  const handleApiError = useApiErrorHandler();
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [favorites, setFavorites] = useState<ProfileFavorite[]>([]);
  const [collectionsCount, setCollectionsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadAnalytics() {
        setIsLoading(true);
        setMessage("");
        const activeSession = session ?? (await requireAuthSession());
        if (!activeSession) {
          if (isMounted) {
            setIsLoading(false);
            setMessage("请先登录后查看资料分析。");
          }
          return;
        }

        try {
          const [postsData, favoritesData, collectionsData] = await Promise.all([
            getMyPosts(activeSession.accessToken),
            getMyFavorites(activeSession.accessToken),
            getMyCollections(activeSession.accessToken),
          ]);
          if (isMounted) {
            setPosts(postsData.items);
            setFavorites(favoritesData.items);
            setCollectionsCount(collectionsData.items.length);
          }
        } catch (error) {
          if (isMounted) {
            handleApiError(error, {
              fallback: "资料分析加载失败，请稍后重试。",
              setMessage,
            });
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      }

      void loadAnalytics();

      return () => {
        isMounted = false;
      };
    }, [handleApiError, requireAuthSession, session]),
  );

  const analytics = useMemo(() => {
    const favoritePosts = favorites.filter(isFavoritePost);
    const authoredTags = buildTagCounts(
      posts.filter((post) => post.status !== "deleted"),
    );
    const favoritedTags = buildTagCounts(favoritePosts);
    const totalLikes = posts.reduce((sum, post) => sum + post.like_count, 0);
    const totalComments = posts.reduce(
      (sum, post) => sum + post.comment_count,
      0,
    );
    const totalFavorites = posts.reduce(
      (sum, post) => sum + post.favorite_count,
      0,
    );
    const draftCount = posts.filter((post) => post.status === "draft").length;
    const topPosts = [...posts]
      .filter((post) => post.status !== "deleted")
      .sort(
        (a, b) =>
          b.like_count +
          b.comment_count +
          b.favorite_count -
          (a.like_count + a.comment_count + a.favorite_count),
      )
      .slice(0, 3);

    return {
      authoredTags,
      authoredTopTag: authoredTags[0]?.tag || "暂无",
      collectionsCount,
      draftCount,
      favoritePostsCount: favoritePosts.length,
      favoritedTags,
      favoritedTopTag: favoritedTags[0]?.tag || "暂无",
      postsCount: posts.length,
      topPosts,
      totalComments,
      totalFavorites,
      totalLikes,
    };
  }, [collectionsCount, favorites, posts]);

  return {
    ...analytics,
    isLoading,
    message,
  };
}

function isFavoritePost(item: ProfileFavorite): item is FavoritePost {
  return "tags" in item;
}

function buildTagCounts(posts: ProfilePost[]): TagCount[] {
  const counts = new Map<string, number>();
  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, 8);
}
