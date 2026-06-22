import { useCallback, useState } from "react";

import { useApiErrorHandler } from "../../../hooks/useApiErrorHandler";
import type { AuthSession } from "../../../services/authSession";
import { getAuthorCollections } from "../../../services/authorApi";
import type { ProfileCollection, ProfilePost } from "../../../services/authorApi";
import {
  getPublicCollectionDetail,
  getPublicPostDetail,
  setCollectionFavorited,
} from "../../../services/profileApi";

type UseAuthorCollectionsOptions = {
  authorId: number;
  session: AuthSession | null;
  onRequireAuth: () => void;
  setIsLoading: (isLoading: boolean) => void;
  setMessage: (message: string) => void;
};

export function useAuthorCollections({
  authorId,
  session,
  onRequireAuth,
  setIsLoading,
  setMessage,
}: UseAuthorCollectionsOptions) {
  const handleApiError = useApiErrorHandler();
  const [collections, setCollections] = useState<ProfileCollection[]>([]);
  const [selectedCollection, setSelectedCollection] =
    useState<ProfileCollection | null>(null);
  const [collectionPosts, setCollectionPosts] = useState<ProfilePost[]>([]);

  const loadCollections = useCallback(async () => {
    return getAuthorCollections(authorId, session?.accessToken);
  }, [authorId, session?.accessToken]);

  const resetSelectedCollection = useCallback(() => {
    setSelectedCollection(null);
    setCollectionPosts([]);
  }, []);

  const openCollection = useCallback(async (collection: ProfileCollection) => {
    setIsLoading(true);
    setMessage("");
    setSelectedCollection(collection);
    setCollectionPosts([]);
    try {
      const detail = await getPublicCollectionDetail(
        collection.id,
        session?.accessToken,
      );
      const detailPosts = await Promise.all(
        detail.items.map((item) =>
          getPublicPostDetail(item.post_id, session?.accessToken),
        ),
      );
      setSelectedCollection(detail);
      setCollectionPosts(detailPosts);
    } catch (error) {
      handleApiError(error, { fallback: "合集加载失败", setMessage });
    } finally {
      setIsLoading(false);
    }
  }, [handleApiError, session?.accessToken, setIsLoading, setMessage]);

  const toggleCollectionFavorite = useCallback(async (collection: ProfileCollection) => {
    if (!session) {
      onRequireAuth();
      return;
    }
    const nextFavorited = !collection.is_favorited;
    setMessage("");
    try {
      await setCollectionFavorited(
        collection.id,
        nextFavorited,
        session.accessToken,
      );
      setCollections((current) =>
        current.map((item) =>
          item.id === collection.id
            ? { ...item, is_favorited: nextFavorited }
            : item,
        ),
      );
      if (selectedCollection?.id === collection.id) {
        setSelectedCollection({
          ...selectedCollection,
          is_favorited: nextFavorited,
        });
      }
    } catch (error) {
      handleApiError(error, { fallback: "合集收藏失败", setMessage });
    }
  }, [handleApiError, onRequireAuth, selectedCollection, session, setMessage]);

  return {
    collections,
    setCollections,
    selectedCollection,
    setSelectedCollection,
    collectionPosts,
    loadCollections,
    resetSelectedCollection,
    openCollection,
    toggleCollectionFavorite,
  };
}
