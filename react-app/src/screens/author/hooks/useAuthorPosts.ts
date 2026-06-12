import { useCallback, useState } from "react";

import { getAuthorPosts } from "../../../services/authorApi";
import type { ProfilePost } from "../../../services/authorApi";

const PAGE_SIZE = 20;

type UseAuthorPostsOptions = {
  authorId: number;
  setMessage: (message: string) => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  setIsLoadingMore: (isLoadingMore: boolean) => void;
};

export function useAuthorPosts({
  authorId,
  setMessage,
  isLoading,
  isLoadingMore,
  setIsLoadingMore,
}: UseAuthorPostsOptions) {
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [postPage, setPostPage] = useState(0);
  const [postTotal, setPostTotal] = useState(0);
  const [postHasMore, setPostHasMore] = useState(true);

  const loadInitialPosts = useCallback(async () => {
    return getAuthorPosts(authorId, 1, PAGE_SIZE);
  }, [authorId]);

  const resetPosts = useCallback(() => {
    setPosts([]);
    setPostPage(0);
    setPostTotal(0);
    setPostHasMore(true);
  }, []);

  const applyInitialPosts = useCallback((items: ProfilePost[], total: number) => {
    setPosts(items);
    setPostPage(1);
    setPostTotal(total);
    setPostHasMore(PAGE_SIZE < total);
  }, []);

  const loadMorePosts = useCallback(async (activeTab: "posts" | "collections") => {
    if (activeTab !== "posts" || isLoading || isLoadingMore || !postHasMore) {
      return;
    }
    setIsLoadingMore(true);
    setMessage("");
    try {
      const nextPage = postPage + 1;
      const data = await getAuthorPosts(authorId, nextPage, PAGE_SIZE);
      setPosts((currentPosts) => appendUniquePosts(currentPosts, data.items));
      setPostPage(nextPage);
      setPostTotal(data.total);
      setPostHasMore(nextPage * PAGE_SIZE < data.total);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更多帖子加载失败");
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    authorId,
    isLoading,
    isLoadingMore,
    postHasMore,
    postPage,
    setIsLoadingMore,
    setMessage,
  ]);

  return {
    posts,
    postTotal,
    resetPosts,
    applyInitialPosts,
    loadInitialPosts,
    loadMorePosts,
  };
}

function appendUniquePosts(
  currentPosts: ProfilePost[],
  incomingPosts: ProfilePost[],
) {
  const existingIds = new Set(currentPosts.map((post) => post.id));
  return [
    ...currentPosts,
    ...incomingPosts.filter((post) => !existingIds.has(post.id)),
  ];
}
