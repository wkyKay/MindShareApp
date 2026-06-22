import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import { useApiErrorHandler } from "../../../hooks/useApiErrorHandler";
import type { AuthSession } from "../../../services/authSession";
import {
  addPostToCollection,
  createCollection,
  deleteCollection,
  getCollectionDetail,
  getPostDetail,
  removePostFromCollection,
  setCollectionFavorited,
  updateCollection,
  type ProfileCollection,
  type ProfileFavorite,
  type FollowingUser,
  type ProfilePost,
} from "../../../services/profileApi";
import type { ProfileTab } from "../ProfileStats";

type UseProfileCollectionsOptions = {
  session: AuthSession;
  selectedCollection: ProfileCollection | null;
  setSelectedCollection: Dispatch<SetStateAction<ProfileCollection | null>>;
  setCollectionPosts: Dispatch<SetStateAction<ProfilePost[]>>;
  setCollections: Dispatch<SetStateAction<ProfileCollection[]>>;
  setFavorites: Dispatch<SetStateAction<ProfileFavorite[]>>;
  movingPost: ProfilePost | null;
  setMovingPost: Dispatch<SetStateAction<ProfilePost | null>>;
  setIsContentLoading: (isLoading: boolean) => void;
  setContentMessage: (message: string) => void;
  setActiveTab: Dispatch<SetStateAction<ProfileTab>>;
};

export function useProfileCollections({
  session,
  selectedCollection,
  setSelectedCollection,
  setCollectionPosts,
  setCollections,
  setFavorites,
  movingPost,
  setMovingPost,
  setIsContentLoading,
  setContentMessage,
  setActiveTab,
}: UseProfileCollectionsOptions) {
  const handleApiError = useApiErrorHandler();
  const [collectionTitle, setCollectionTitle] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [editingCollection, setEditingCollection] =
    useState<ProfileCollection | null>(null);
  const [isCollectionFormOpen, setIsCollectionFormOpen] = useState(false);

  function resetCollectionForm() {
    setCollectionTitle("");
    setCollectionDescription("");
    setEditingCollection(null);
    setIsCollectionFormOpen(false);
  }

  async function openCollection(collection: ProfileCollection) {
    setIsContentLoading(true);
    setContentMessage("");
    setSelectedCollection(collection);
    setCollectionPosts([]);

    try {
      const detail = await getCollectionDetail(
        collection.id,
        session.accessToken,
      );
      const detailPosts = await Promise.all(
        detail.items.map((item) =>
          getPostDetail(item.post_id, session.accessToken),
        ),
      );
      setSelectedCollection(detail);
      setCollectionPosts(detailPosts);
    } catch (error) {
      handleApiError(error, {
        fallback: "合集加载失败，请稍后重试。",
        setMessage: setContentMessage,
      });
    } finally {
      setIsContentLoading(false);
    }
  }

  async function submitCollection() {
    const title = collectionTitle.trim();
    if (!title) {
      setContentMessage("请先为合集取名。");
      return;
    }
    setIsContentLoading(true);
    setContentMessage("");
    try {
      if (editingCollection) {
        await updateCollection(
          editingCollection.id,
          title,
          collectionDescription.trim(),
          session.accessToken,
        );
        setCollections((current) =>
          current.map((collection) =>
            collection.id === editingCollection.id
              ? {
                  ...collection,
                  title,
                  description: collectionDescription.trim() || null,
                }
              : collection,
          ),
        );
        if (selectedCollection?.id === editingCollection.id) {
          setSelectedCollection({
            ...selectedCollection,
            title,
            description: collectionDescription.trim() || null,
          });
        }
      } else {
        const created = await createCollection(
          title,
          collectionDescription.trim(),
          session.accessToken,
        );
        setCollections((current) => [
          {
            ...created,
            description: collectionDescription.trim() || null,
            item_count: 0,
          },
          ...current,
        ]);
      }
      resetCollectionForm();
    } catch (error) {
      handleApiError(error, {
        fallback: "合集保存失败。",
        setMessage: setContentMessage,
      });
    } finally {
      setIsContentLoading(false);
    }
  }

  function startEditCollection(collection: ProfileCollection) {
    setEditingCollection(collection);
    setCollectionTitle(collection.title);
    setCollectionDescription(collection.description || "");
    setIsCollectionFormOpen(true);
    setActiveTab("collections");
  }

  function confirmDeleteCollection(collection: ProfileCollection) {
    const confirm =
      typeof globalThis.confirm === "function"
        ? globalThis.confirm("删除合集文件夹？其中的文章不会被删除。")
        : true;
    if (confirm) {
      void handleDeleteCollection(collection);
    }
  }

  async function handleDeleteCollection(collection: ProfileCollection) {
    setIsContentLoading(true);
    setContentMessage("");
    try {
      await deleteCollection(collection.id, session.accessToken);
      setCollections((current) =>
        current.filter((item) => item.id !== collection.id),
      );
      setFavorites((current) =>
        current.filter(
          (item) => !isCollectionFavorite(item) || item.id !== collection.id,
        ),
      );
      if (selectedCollection?.id === collection.id) {
        setSelectedCollection(null);
        setCollectionPosts([]);
      }
      if (editingCollection?.id === collection.id) {
        resetCollectionForm();
      }
    } catch (error) {
      handleApiError(error, {
        fallback: "合集删除失败。",
        setMessage: setContentMessage,
      });
    } finally {
      setIsContentLoading(false);
    }
  }

  async function movePostToCollection(collection: ProfileCollection) {
    if (!movingPost) return;
    setIsContentLoading(true);
    setContentMessage("");
    try {
      await addPostToCollection(
        collection.id,
        movingPost.id,
        session.accessToken,
      );
      setCollections((current) =>
        current.map((item) =>
          item.id === collection.id
            ? { ...item, item_count: (item.item_count ?? 0) + 1 }
            : item,
        ),
      );
      setMovingPost(null);
    } catch (error) {
      handleApiError(error, {
        fallback: "移入合集失败。",
        setMessage: setContentMessage,
      });
    } finally {
      setIsContentLoading(false);
    }
  }

  async function removeCurrentCollectionPost(post: ProfilePost) {
    if (!selectedCollection) return;
    setIsContentLoading(true);
    setContentMessage("");
    try {
      await removePostFromCollection(
        selectedCollection.id,
        post.id,
        session.accessToken,
      );
      setCollectionPosts((current) =>
        current.filter((item) => item.id !== post.id),
      );
      setCollections((current) =>
        current.map((item) =>
          item.id === selectedCollection.id
            ? { ...item, item_count: Math.max(0, (item.item_count ?? 0) - 1) }
            : item,
        ),
      );
    } catch (error) {
      handleApiError(error, {
        fallback: "移出合集失败。",
        setMessage: setContentMessage,
      });
    } finally {
      setIsContentLoading(false);
    }
  }

  async function toggleCollectionFavorite(collection: ProfileCollection) {
    const nextFavorited = !collection.is_favorited;
    setContentMessage("");
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
      setFavorites((current) =>
        nextFavorited
          ? [
              {
                ...collection,
                is_favorited: true,
                favorite_type: "collection",
              },
              ...current,
            ]
          : current.filter(
              (item) =>
                !isCollectionFavorite(item) || item.id !== collection.id,
            ),
      );
      if (selectedCollection?.id === collection.id) {
        setSelectedCollection({
          ...selectedCollection,
          is_favorited: nextFavorited,
        });
      }
    } catch (error) {
      handleApiError(error, {
        fallback: "合集收藏失败。",
        setMessage: setContentMessage,
      });
    }
  }

  return {
    collectionTitle,
    setCollectionTitle,
    collectionDescription,
    setCollectionDescription,
    editingCollection,
    isCollectionFormOpen,
    setIsCollectionFormOpen,
    resetCollectionForm,
    openCollection,
    submitCollection,
    startEditCollection,
    confirmDeleteCollection,
    movePostToCollection,
    removeCurrentCollectionPost,
    toggleCollectionFavorite,
  };
}

export function isCollectionFavorite(
  item: ProfilePost | ProfileCollection | ProfileFavorite | FollowingUser,
): item is ProfileCollection {
  return "favorite_type" in item && item.favorite_type === "collection";
}
