import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import type { AuthSession } from "../../../services/authSession";
import type { ProfilePost } from "../../../services/profileApi";
import { deletePost } from "../../../services/postApi";

type UseProfilePostActionsOptions = {
  session: AuthSession;
  onEditPost: (postId: number) => void;
  setPosts: Dispatch<SetStateAction<ProfilePost[]>>;
  setCollectionPosts: Dispatch<SetStateAction<ProfilePost[]>>;
  setIsContentLoading: (isLoading: boolean) => void;
  setContentMessage: (message: string) => void;
};

export function useProfilePostActions({
  session,
  onEditPost,
  setPosts,
  setCollectionPosts,
  setIsContentLoading,
  setContentMessage,
}: UseProfilePostActionsOptions) {
  const [movingPost, setMovingPost] = useState<ProfilePost | null>(null);
  const [actionPostId, setActionPostId] = useState<number | null>(null);
  const [postPendingDelete, setPostPendingDelete] =
    useState<ProfilePost | null>(null);

  function editProfilePost(post: ProfilePost) {
    setActionPostId(null);
    onEditPost(post.id);
  }

  function startMoveProfilePost(post: ProfilePost) {
    setActionPostId(null);
    setMovingPost(post);
  }

  function confirmDeletePost(post: ProfilePost) {
    setActionPostId(null);
    setPostPendingDelete(post);
  }

  async function handleDeletePost(post: ProfilePost) {
    setActionPostId(null);
    setIsContentLoading(true);
    setContentMessage("");
    try {
      await deletePost(post.id, session.accessToken);
      setPostPendingDelete(null);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setCollectionPosts((current) =>
        current.filter((item) => item.id !== post.id),
      );
    } catch (error) {
      setContentMessage(
        error instanceof Error ? error.message : "博客删除失败。",
      );
    } finally {
      setIsContentLoading(false);
    }
  }

  return {
    movingPost,
    setMovingPost,
    actionPostId,
    setActionPostId,
    postPendingDelete,
    setPostPendingDelete,
    editProfilePost,
    startMoveProfilePost,
    confirmDeletePost,
    handleDeletePost,
  };
}
