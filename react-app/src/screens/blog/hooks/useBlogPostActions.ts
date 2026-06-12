import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import * as Haptics from "expo-haptics";

import {
  deletePost,
  setPostFavorited,
  setPostLiked,
  type PostDetail,
} from "../../../services/postApi";
import type { AuthSession } from "../../../services/authSession";

type UseBlogPostActionsOptions = {
  currentSession: AuthSession | null;
  onDeleted: () => void;
  onRequireAuth: () => void;
  requireAuthSession: () => Promise<AuthSession | null>;
  setMessage: (message: string) => void;
  setPost: Dispatch<SetStateAction<PostDetail | null>>;
};

export function useBlogPostActions({
  currentSession,
  onDeleted,
  onRequireAuth,
  requireAuthSession,
  setMessage,
  setPost,
}: UseBlogPostActionsOptions) {
  const requireSession = useCallback(async () => {
    const activeSession = await requireAuthSession();
    if (!activeSession) {
      onRequireAuth();
      return null;
    }
    return activeSession;
  }, [onRequireAuth, requireAuthSession]);

  const toggleLike = useCallback(
    async (post: PostDetail | null) => {
      if (!post) {
        return;
      }
      const activeSession = await requireSession();
      if (!activeSession) {
        return;
      }
      try {
        const data = await setPostLiked(
          post.id,
          !post.is_liked,
          activeSession.accessToken,
        );
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPost({
          ...post,
          is_liked: data.liked,
          like_count: data.like_count,
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "点赞失败。");
      }
    },
    [requireSession, setMessage, setPost],
  );

  const toggleFavorite = useCallback(
    async (post: PostDetail | null) => {
      if (!post) {
        return;
      }
      const activeSession = await requireSession();
      if (!activeSession) {
        return;
      }
      try {
        const data = await setPostFavorited(
          post.id,
          !post.is_favorited,
          activeSession.accessToken,
        );
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPost({
          ...post,
          is_favorited: data.favorited,
          favorite_count: data.favorite_count,
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "收藏失败。");
      }
    },
    [requireSession, setMessage, setPost],
  );

  const removePost = useCallback(
    async (post: PostDetail | null) => {
      if (!post || !currentSession) {
        return;
      }
      try {
        await deletePost(post.id, currentSession.accessToken);
        onDeleted();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "删除失败。");
      }
    },
    [currentSession, onDeleted, setMessage],
  );

  return {
    removePost,
    requireSession,
    toggleFavorite,
    toggleLike,
  };
}
