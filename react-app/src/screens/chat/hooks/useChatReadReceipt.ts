import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

import type { AuthSession } from "../../../services/authSession";
import { markConversationRead } from "../../../services/messagesApi";

type UseChatReadReceiptOptions = {
  conversationId: number;
  loadLatestMessages: () => Promise<void>;
  markConversationReadLocal: (
    session: AuthSession,
    conversationId: number,
  ) => void | Promise<void>;
  session: AuthSession | null;
};

export function useChatReadReceipt({
  conversationId,
  loadLatestMessages,
  markConversationReadLocal,
  session,
}: UseChatReadReceiptOptions) {
  useFocusEffect(
    useCallback(() => {
      if (!session || !conversationId) return;
      void loadLatestMessages();
      void markConversationRead(session.accessToken, conversationId);
      void markConversationReadLocal(session, conversationId);
    }, [conversationId, loadLatestMessages, markConversationReadLocal, session]),
  );
}
