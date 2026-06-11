import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import type { AuthSession } from "../../../services/authSession";
import {
  getMyCollections,
  getMyFavorites,
  getMyFollowing,
  getMyPosts,
  type FollowingUser,
  type ProfileCollection,
  type ProfileFavorite,
  type ProfilePost,
} from "../../../services/profileApi";

export function useProfileContent(session: AuthSession) {
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [favorites, setFavorites] = useState<ProfileFavorite[]>([]);
  const [collections, setCollections] = useState<ProfileCollection[]>([]);
  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [selectedCollection, setSelectedCollection] =
    useState<ProfileCollection | null>(null);
  const [collectionPosts, setCollectionPosts] = useState<ProfilePost[]>([]);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [contentMessage, setContentMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadContent() {
        setIsContentLoading(true);
        setContentMessage("");
        setSelectedCollection(null);
        setCollectionPosts([]);

        try {
          const [postsData, favoritesData, collectionsData, followingData] =
            await Promise.all([
              getMyPosts(session.accessToken),
              getMyFavorites(session.accessToken),
              getMyCollections(session.accessToken),
              getMyFollowing(session.accessToken),
            ]);
          if (isMounted) {
            setPosts(postsData.items);
            setFavorites(favoritesData.items);
            setCollections(collectionsData.items);
            setFollowing(followingData.items);
          }
        } catch (error) {
          if (isMounted) {
            setContentMessage(
              error instanceof Error
                ? error.message
                : "内容加载失败，请稍后重试。",
            );
          }
        } finally {
          if (isMounted) {
            setIsContentLoading(false);
          }
        }
      }

      void loadContent();

      return () => {
        isMounted = false;
      };
    }, [session.accessToken]),
  );

  const hasLoadedProfileContent =
    posts.length > 0 ||
    favorites.length > 0 ||
    collections.length > 0 ||
    following.length > 0;

  return {
    posts,
    setPosts,
    favorites,
    setFavorites,
    collections,
    setCollections,
    following,
    selectedCollection,
    setSelectedCollection,
    collectionPosts,
    setCollectionPosts,
    isContentLoading,
    setIsContentLoading,
    contentMessage,
    setContentMessage,
    hasLoadedProfileContent,
  };
}
