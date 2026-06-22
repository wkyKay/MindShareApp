import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { TabView } from "react-native-tab-view";

import { HomePostListSkeleton } from "../components/Skeleton";
import { useDelayedLoading } from "../hooks/useDelayedLoading";
import type { AuthSession } from "../services/authSession";
import type { Post } from "../services/homeApi";
import { useAppStyles } from "../theme/ThemeProvider";
import { DiscoverHeader } from "./home/DiscoverHeader";
import { HomePostList } from "./home/HomePostList";
import { HomePostListItem } from "./home/HomePostListItem";
import { HomeSegmentedTabs } from "./home/HomeSegmentedTabs";
import { useDiscoverFeed } from "./home/hooks/useDiscoverFeed";
import { useFollowingFeed } from "./home/hooks/useFollowingFeed";
import { useHomePostActions } from "./home/hooks/useHomePostActions";
import { useHomeSearch } from "./home/hooks/useHomeSearch";
import { useHomeTagNavigation } from "./home/hooks/useHomeTagNavigation";
import { useHomeTabs } from "./home/hooks/useHomeTabs";

type HomeScreenProps = {
  onOpenPost: (postId: number) => void;
  onOpenAuthor: (authorId: number) => void;
  onOpenTag: (tag: string) => void;
  session: AuthSession | null;
  selectedRouteTag?: string;
};

const TAB_ROUTES = [
  { key: "discover", title: "发现" },
  { key: "following", title: "关注" },
];

export function HomeScreen({
  onOpenPost,
  onOpenAuthor,
  onOpenTag,
  session,
  selectedRouteTag,
}: HomeScreenProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const {
    isDiscover,
    section,
    setSection,
    switchSection: setActiveSection,
    tabIndex,
  } = useHomeTabs();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [contentMessage, setContentMessage] = useState("");
  const layout = useWindowDimensions();
  const selectedTag = selectedRouteTag ?? null;
  const {
    clearSearch,
    isSearchFocused,
    searchError,
    searchStatus,
    setIsSearchFocused,
    setTagQuery,
    tagQuery,
    tagSuggestions,
    titleMatches,
    userSuggestions,
  } = useHomeSearch({ selectedTag, session });
  const {
    discoverHasMore,
    discoverPage,
    discoverPosts,
    loadDiscoverPage,
    refreshDiscover,
    resetDiscover,
    setDiscoverPosts,
  } = useDiscoverFeed({ selectedTag, session, setContentMessage });
  const {
    followingHasMore,
    followingPage,
    followingPosts,
    loadFollowingPage,
    resetFollowing,
    setFollowingPosts,
  } = useFollowingFeed({ setContentMessage });
  const { actionPostId, markPostDisliked, setActionPostId } =
    useHomePostActions({
      session,
      setContentMessage,
      setDiscoverPosts,
      setFollowingPosts,
    });
  const { clearTag, selectTag } = useHomeTagNavigation({
    selectedTag,
    clearSearch,
    onOpenTag,
    refreshDiscover,
    resetDiscover,
    setContentMessage,
    setIsInitialLoading,
    setSection,
  });

  const posts = isDiscover ? discoverPosts : followingPosts;
  const page = isDiscover ? discoverPage : followingPage;
  const hasMore = isDiscover ? discoverHasMore : followingHasMore;
  const showInitialSkeleton = useDelayedLoading(
    isInitialLoading && posts.length === 0,
    300,
  );

  useEffect(() => {
    let isMounted = true;
    async function loadInitialPosts() {
      setIsInitialLoading(true);
      try {
        await loadDiscoverPage(1, true, selectedRouteTag ?? null);
      } catch (error) {
        if (isMounted) {
          setContentMessage(
            error instanceof Error ? error.message : "内容加载失败",
          );
        }
      } finally {
        if (isMounted) {
          setIsInitialLoading(false);
        }
      }
    }
    void loadInitialPosts();
    return () => {
      isMounted = false;
    };
  }, [loadDiscoverPage, selectedRouteTag, session?.accessToken]);

  useEffect(() => {
    if (
      section === "following" &&
      session?.accessToken &&
      followingPage === 0
    ) {
      void loadFollowingPage(1, session.accessToken, true);
    }
  }, [followingPage, loadFollowingPage, section, session]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || isRefreshing || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      if (isDiscover) {
        await loadDiscoverPage(page + 1);
      } else if (session?.accessToken) {
        await loadFollowingPage(page + 1, session.accessToken);
      }
    } catch (error) {
      setContentMessage(
        error instanceof Error ? error.message : "内容加载失败",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    hasMore,
    isDiscover,
    isLoadingMore,
    isRefreshing,
    loadDiscoverPage,
    loadFollowingPage,
    page,
    session?.accessToken,
  ]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setContentMessage("");
    try {
      if (isDiscover) {
        await refreshDiscover(selectedTag);
      } else if (session?.accessToken) {
        await loadFollowingPage(1, session.accessToken, true);
      }
    } catch (error) {
      setContentMessage(
        error instanceof Error ? error.message : "内容加载失败",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [
    isDiscover,
    loadFollowingPage,
    refreshDiscover,
    selectedTag,
    session?.accessToken,
  ]);

  const switchSection = useCallback((nextSection: "discover" | "following") => {
    setContentMessage("");
    setActiveSection(nextSection);
    if (nextSection === "following") {
      resetFollowing();
      if (session?.accessToken) {
        setIsInitialLoading(true);
        void loadFollowingPage(1, session.accessToken, true)
          .catch((error) =>
            setContentMessage(
              error instanceof Error ? error.message : "内容加载失败",
            ),
          )
          .finally(() => setIsInitialLoading(false));
      }
    }
  }, [loadFollowingPage, resetFollowing, session?.accessToken, setActiveSection]);

  function renderFooter() {
    if (showInitialSkeleton) {
      return <HomePostListSkeleton />;
    }
    if (isLoadingMore) {
      return <ActivityIndicator style={{ padding: 16 }} />;
    }
    if (contentMessage) {
      return (
        <Text style={[styles.authApiHint, { color: "#a05d6f", padding: 16 }]}>
          {contentMessage}
        </Text>
      );
    }
    if (posts.length === 0) {
      return isDiscover ? (
        <Text style={[styles.authApiHint, { padding: 16 }]}>
          {selectedTag ? t("该标签下暂无博客。") : t("暂无推荐博客。")}
        </Text>
      ) : null;
    }
    if (!hasMore) {
      return (
        <Text style={[styles.authApiHint, { padding: 16 }]}>
          {t("没有更多内容了")}
        </Text>
      );
    }
    return null;
  }

  const renderPostItem = useCallback((item: Post) => {
    return (
      <HomePostListItem
        actionPostId={actionPostId}
        onClearAction={() => setActionPostId(null)}
        onDislikePost={(postId) => void markPostDisliked(postId)}
        onOpenPost={onOpenPost}
        onOpenTag={selectTag}
        onShowAction={setActionPostId}
        post={item}
        styles={styles}
        t={t}
      />
    );
  }, [
    actionPostId,
    markPostDisliked,
    onOpenPost,
    selectTag,
    setActionPostId,
    styles,
    t,
  ]);

  const renderFlatListItem = useCallback(
    ({ item }: { item: Post }) => renderPostItem(item),
    [renderPostItem],
  );

  function renderDiscoverHeader() {
    return (
      <DiscoverHeader
        selectedTag={selectedTag}
        searchError={searchError}
        searchStatus={searchStatus}
        tagQuery={tagQuery}
        tagSuggestions={tagSuggestions}
        userSuggestions={userSuggestions}
        titleMatches={titleMatches}
        onChangeQuery={setTagQuery}
        onClearTag={clearTag}
        onOpenPost={onOpenPost}
        onOpenAuthor={onOpenAuthor}
        onSelectTag={selectTag}
        onSearchFocusChange={setIsSearchFocused}
        styles={styles}
        t={t}
      />
    );
  }

  function renderHomeList(target: "discover" | "following") {
    const targetPosts = target === "discover" ? discoverPosts : followingPosts;
    return (
      <HomePostList
        footer={renderFooter}
        header={target === "discover" ? renderDiscoverHeader() : null}
        isRefreshing={isRefreshing}
        onEndReached={() => void loadMore()}
        onRefresh={() => void refresh()}
        posts={targetPosts}
        renderPostItem={renderFlatListItem}
        section={section}
        styles={styles}
        target={target}
      />
    );
  }

  return (
    <View style={styles.homeScreen}>
      <HomeSegmentedTabs
        isDiscover={isDiscover}
        onChangeSection={switchSection}
        styles={styles}
        t={t}
      />

      <TabView
        navigationState={{ index: tabIndex, routes: TAB_ROUTES }}
        renderScene={({ route }) =>
          renderHomeList(route.key as "discover" | "following")
        }
        renderTabBar={() => null}
        onIndexChange={(nextIndex) =>
          switchSection(nextIndex === 0 ? "discover" : "following")
        }
        initialLayout={{ width: layout.width }}
        style={styles.homeScreen}
        swipeEnabled={!isSearchFocused}
        lazy
      />
    </View>
  );
}
