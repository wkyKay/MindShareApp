import { useCallback, useRef, useState } from "react";

import type { AuthSession } from "../../../services/authSession";
import { getDiscoverPosts, type Post } from "../../../services/homeApi";

const PAGE_SIZE = 10;

type UseDiscoverFeedOptions = {
  selectedTag: string | null;
  session: AuthSession | null;
  setContentMessage: (message: string) => void;
};

export function useDiscoverFeed({
  selectedTag,
  session,
  setContentMessage,
}: UseDiscoverFeedOptions) {
  const [discoverPosts, setDiscoverPosts] = useState<Post[]>([]);
  const [discoverPage, setDiscoverPage] = useState(0);
  const [discoverHasMore, setDiscoverHasMore] = useState(true);
  const discoverSeed = useRef(Date.now());

  const loadDiscoverPage = useCallback(
    async (nextPage: number, replace = false, tagName = selectedTag) => {
      setContentMessage("");
      const data = await getDiscoverPosts(
        nextPage,
        PAGE_SIZE,
        discoverSeed.current,
        tagName,
        session?.accessToken,
      );
      setDiscoverPosts((currentPosts) =>
        replace ? data.items : appendUniquePosts(currentPosts, data.items),
      );
      setDiscoverHasMore(nextPage * PAGE_SIZE < data.total);
      setDiscoverPage(nextPage);
    },
    [selectedTag, session?.accessToken, setContentMessage],
  );

  const resetDiscover = useCallback(() => {
    setDiscoverPosts([]);
    setDiscoverPage(0);
    setDiscoverHasMore(true);
    discoverSeed.current = Date.now();
  }, []);

  const refreshDiscover = useCallback(
    async (tagName = selectedTag) => {
      discoverSeed.current = Date.now();
      await loadDiscoverPage(1, true, tagName);
    },
    [loadDiscoverPage, selectedTag],
  );

  return {
    discoverHasMore,
    discoverPage,
    discoverPosts,
    loadDiscoverPage,
    refreshDiscover,
    resetDiscover,
    setDiscoverPosts,
  };
}

function appendUniquePosts(currentPosts: Post[], incomingPosts: Post[]) {
  const existingIds = new Set(currentPosts.map((post) => post.id));
  return [
    ...currentPosts,
    ...incomingPosts.filter((post) => !existingIds.has(post.id)),
  ];
}
