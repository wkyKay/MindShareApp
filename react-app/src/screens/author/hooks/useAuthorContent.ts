import { useEffect, useState } from "react";

import type { AuthSession } from "../../../services/authSession";
import { useAuthorCollections } from "./useAuthorCollections";
import { useAuthorPosts } from "./useAuthorPosts";
import { useAuthorProfile } from "./useAuthorProfile";

type UseAuthorContentOptions = {
  authorId: number;
  session: AuthSession | null;
  onOpenMessage: (
    conversationId: number,
    partnerId: number,
    partnerName: string,
  ) => void;
  onRequireAuth: () => void;
};

export function useAuthorContent({
  authorId,
  session,
  onOpenMessage,
  onRequireAuth,
}: UseAuthorContentOptions) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [message, setMessage] = useState("");
  const {
    author,
    setAuthor,
    loadAuthor,
    toggleFollow,
    openMessage,
  } = useAuthorProfile({
    authorId,
    session,
    onOpenMessage,
    onRequireAuth,
    setMessage,
  });
  const {
    posts,
    postTotal,
    resetPosts,
    applyInitialPosts,
    loadInitialPosts,
    loadMorePosts,
  } = useAuthorPosts({
    authorId,
    setMessage,
    isLoading,
    isLoadingMore,
    setIsLoadingMore,
  });
  const {
    collections,
    setCollections,
    selectedCollection,
    setSelectedCollection,
    collectionPosts,
    loadCollections,
    resetSelectedCollection,
    openCollection,
    toggleCollectionFavorite,
  } = useAuthorCollections({
    authorId,
    session,
    onRequireAuth,
    setIsLoading,
    setMessage,
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchAuthorData() {
      try {
        setIsLoading(true);
        setMessage("");
        resetPosts();
        resetSelectedCollection();
        const [authorData, postsData, collectionsData] = await Promise.all([
          loadAuthor(),
          loadInitialPosts(),
          loadCollections(),
        ]);
        if (!isMounted) return;
        applyInitialPosts(postsData.items, postsData.total);
        setCollections(collectionsData);
        setSelectedCollection(null);
        setAuthor(authorData);
      } catch (error) {
        if (isMounted) {
          setMessage(
            error instanceof Error ? error.message : "作者内容加载失败",
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void fetchAuthorData();

    return () => {
      isMounted = false;
    };
  }, [
    applyInitialPosts,
    loadAuthor,
    loadCollections,
    loadInitialPosts,
    resetPosts,
    resetSelectedCollection,
    setAuthor,
    setCollections,
    setSelectedCollection,
  ]);

  return {
    isLoading,
    isLoadingMore,
    message,
    author,
    toggleFollow,
    openMessage,
    posts,
    postTotal,
    loadMorePosts,
    collections,
    selectedCollection,
    setSelectedCollection,
    collectionPosts,
    openCollection,
    toggleCollectionFavorite,
  };
}
