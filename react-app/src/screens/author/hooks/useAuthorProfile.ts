import { useCallback, useState } from "react";

import type { AuthSession } from "../../../services/authSession";
import { getAuthorInfo, setAuthorFollowing } from "../../../services/authorApi";
import type { AuthorInfo } from "../../../services/authorApi";
import { createOrGetConversation } from "../../../services/messagesApi";

type UseAuthorProfileOptions = {
  authorId: number;
  session: AuthSession | null;
  onOpenMessage: (
    conversationId: number,
    partnerId: number,
    partnerName: string,
  ) => void;
  onRequireAuth: () => void;
  setMessage: (message: string) => void;
};

export function useAuthorProfile({
  authorId,
  session,
  onOpenMessage,
  onRequireAuth,
  setMessage,
}: UseAuthorProfileOptions) {
  const [author, setAuthor] = useState<AuthorInfo | null>(null);

  const loadAuthor = useCallback(async () => {
    return getAuthorInfo(authorId, session?.accessToken);
  }, [authorId, session?.accessToken]);

  const toggleFollow = useCallback(async () => {
    if (!session) {
      onRequireAuth();
      return;
    }
    if (!author || author.id === session.user.id) {
      return;
    }
    setMessage("");
    try {
      const data = await setAuthorFollowing(
        author.id,
        session.accessToken,
        !author.is_following,
      );
      setAuthor({ ...author, is_following: data.following });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "关注操作失败");
    }
  }, [author, onRequireAuth, session, setMessage]);

  const openMessage = useCallback(async () => {
    if (!session) {
      onRequireAuth();
      return;
    }
    if (!author) return;
    try {
      const conversation = await createOrGetConversation(
        session.accessToken,
        author.id,
      );
      onOpenMessage(conversation.id, author.id, author.display_name);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "私信打开失败");
    }
  }, [author, onOpenMessage, onRequireAuth, session, setMessage]);

  return {
    author,
    setAuthor,
    loadAuthor,
    toggleFollow,
    openMessage,
  };
}
