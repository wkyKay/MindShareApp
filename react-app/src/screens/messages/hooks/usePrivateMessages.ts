import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import {
  createOrGetConversation,
  deleteConversation,
  getFollowingUsers,
  listConversations,
  type ConversationItem,
  type SearchUserItem,
} from "../../../services/messagesApi";
import type { AuthSession } from "../../../services/authSession";

type UsePrivateMessagesOptions = {
  session: AuthSession | null;
  onOpenAuth: () => void;
  onOpenChat: (
    conversationId: number,
    partnerId: number,
    partnerName: string,
  ) => void;
};

export function usePrivateMessages({
  session,
  onOpenAuth,
  onOpenChat,
}: UsePrivateMessagesOptions) {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [following, setFollowing] = useState<SearchUserItem[]>([]);
  const [message, setMessage] = useState("");

  const loadPrivateMessages = useCallback(async () => {
    if (!session) return;
    try {
      const [conversationData, followingData] = await Promise.all([
        listConversations(session.accessToken),
        getFollowingUsers(session.accessToken),
      ]);
      setConversations(conversationData);
      setFollowing(followingData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "私信加载失败");
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      void loadPrivateMessages();
    }, [loadPrivateMessages, session]),
  );

  async function startChat(partnerId: number, partnerName: string) {
    if (!session) {
      onOpenAuth();
      return;
    }
    const data = await createOrGetConversation(session.accessToken, partnerId);
    onOpenChat(data.id, partnerId, partnerName);
  }

  async function removeConversation(conversationId: number) {
    if (!session) return;
    setConversations((current) =>
      current.filter((item) => item.id !== conversationId),
    );
    try {
      await deleteConversation(session.accessToken, conversationId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除会话失败");
      void loadPrivateMessages();
    }
  }

  return {
    conversations,
    following,
    message,
    removeConversation,
    startChat,
  };
}
