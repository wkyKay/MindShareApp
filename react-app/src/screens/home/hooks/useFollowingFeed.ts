import { useCallback, useState } from "react";

import { getFollowingPosts, type Post } from "../../../services/homeApi";

const PAGE_SIZE = 10;

type UseFollowingFeedOptions = {
  setContentMessage: (message: string) => void;
};

export function useFollowingFeed({ setContentMessage }: UseFollowingFeedOptions) {
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [followingPage, setFollowingPage] = useState(0);
  const [followingHasMore, setFollowingHasMore] = useState(true);

  const loadFollowingPage = useCallback(
    async (nextPage: number, token: string, replace = false) => {
      setContentMessage("");
      const data = await getFollowingPosts(nextPage, token, PAGE_SIZE);
      setFollowingPosts((currentPosts) =>
        replace ? data.items : appendUniquePosts(currentPosts, data.items),
      );
      setFollowingHasMore(nextPage * PAGE_SIZE < data.total);
      setFollowingPage(nextPage);
    },
    [setContentMessage],
  );

  const resetFollowing = useCallback(() => {
    setFollowingPosts([]);
    setFollowingPage(0);
    setFollowingHasMore(true);
  }, []);

  return {
    followingHasMore,
    followingPage,
    followingPosts,
    loadFollowingPage,
    resetFollowing,
    setFollowingPosts,
  };
}

function appendUniquePosts(currentPosts: Post[], incomingPosts: Post[]) {
  const existingIds = new Set(currentPosts.map((post) => post.id));
  return [
    ...currentPosts,
    ...incomingPosts.filter((post) => !existingIds.has(post.id)),
  ];
}
