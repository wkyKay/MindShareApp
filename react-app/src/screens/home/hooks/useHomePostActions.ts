import type { Dispatch, SetStateAction } from "react";
import { useCallback, useState } from "react";

import { useApiErrorHandler } from "../../../hooks/useApiErrorHandler";
import type { AuthSession } from "../../../services/authSession";
import type { Post } from "../../../services/homeApi";
import { dislikePost } from "../../../services/postApi";

type UseHomePostActionsOptions = {
  session: AuthSession | null;
  setContentMessage: (message: string) => void;
  setDiscoverPosts: Dispatch<SetStateAction<Post[]>>;
  setFollowingPosts: Dispatch<SetStateAction<Post[]>>;
};

export function useHomePostActions({
  session,
  setContentMessage,
  setDiscoverPosts,
  setFollowingPosts,
}: UseHomePostActionsOptions) {
  const handleApiError = useApiErrorHandler();
  const [actionPostId, setActionPostId] = useState<number | null>(null);

  const markPostDisliked = useCallback(
    async (postId: number) => {
      setActionPostId(null);
      if (!session?.accessToken) {
        setContentMessage("请先登录后再标记不喜欢。");
        return;
      }
      setDiscoverPosts((current) => current.filter((post) => post.id !== postId));
      setFollowingPosts((current) =>
        current.filter((post) => post.id !== postId),
      );
      try {
        await dislikePost(postId, session.accessToken);
      } catch (error) {
        handleApiError(error, {
          fallback: "操作失败，请稍后重试。",
          setMessage: setContentMessage,
        });
      }
    },
    [
      handleApiError,
      session?.accessToken,
      setContentMessage,
      setDiscoverPosts,
      setFollowingPosts,
    ],
  );

  return {
    actionPostId,
    markPostDisliked,
    setActionPostId,
  };
}
