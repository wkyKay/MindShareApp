import { useCallback, useState } from "react";

import { useApiErrorHandler } from "../../../hooks/useApiErrorHandler";
import type { AuthSession } from "../../../services/authSession";
import { sendMessage, type Message } from "../../../services/messagesApi";

type UseChatComposerOptions = {
  appendMessage: (message: Message) => void;
  conversationId: number;
  onRequireAuth: () => void;
  session: AuthSession | null;
  setMessage: (message: string) => void;
};

export function useChatComposer({
  appendMessage,
  conversationId,
  onRequireAuth,
  session,
  setMessage,
}: UseChatComposerOptions) {
  const handleApiError = useApiErrorHandler();
  const [body, setBody] = useState("");

  const submit = useCallback(async () => {
    if (!session) {
      onRequireAuth();
      return;
    }
    const text = body.trim();
    if (!text) return;
    try {
      const created = await sendMessage(
        session.accessToken,
        conversationId,
        text,
      );
      appendMessage(created);
      setBody("");
    } catch (error) {
      handleApiError(error, { fallback: "发送失败", setMessage });
    }
  }, [
    appendMessage,
    body,
    conversationId,
    handleApiError,
    onRequireAuth,
    session,
    setMessage,
  ]);

  return {
    body,
    setBody,
    submit,
  };
}
