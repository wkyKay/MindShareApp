import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

import {
  listMessages,
  type Message,
} from "../../../services/messagesApi";
import type { AuthSession } from "../../../services/authSession";
import { useApiErrorHandler } from "../../../hooks/useApiErrorHandler";

const MESSAGE_PAGE_SIZE = 50;

type UseChatMessagesOptions = {
  conversationId: number;
  latestMessage?: Message;
  session: AuthSession | null;
  setMessage: (message: string) => void;
};

export function useChatMessages({
  conversationId,
  latestMessage,
  session,
  setMessage,
}: UseChatMessagesOptions) {
  const handleApiError = useApiErrorHandler();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListReady, setIsListReady] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const loadingOlderMessagesRef = useRef(false);
  const pageRef = useRef(1);
  const hasMoreMessagesRef = useRef(true);
  const scrollOffsetRef = useRef(0);
  const contentHeightRef = useRef(0);
  const olderContentHeightRef = useRef<number | null>(null);

  const loadLatestMessages = useCallback(async () => {
    if (!session || !conversationId) return;
    try {
      loadingOlderMessagesRef.current = false;
      scrollOffsetRef.current = 0;
      contentHeightRef.current = 0;
      olderContentHeightRef.current = null;
      setMessages([]);
      setIsListReady(false);
      pageRef.current = 1;
      hasMoreMessagesRef.current = true;
      const data = await listMessages(
        session.accessToken,
        conversationId,
        1,
        MESSAGE_PAGE_SIZE,
      );
      setMessages(data);
      hasMoreMessagesRef.current = data.length === MESSAGE_PAGE_SIZE;
      if (!data.length) {
        setIsListReady(true);
      }
    } catch (error) {
      handleApiError(error, { fallback: "消息加载失败", setMessage });
    }
  }, [conversationId, handleApiError, session, setMessage]);

  useEffect(() => {
    if (!latestMessage) {
      return;
    }
    setMessages((current) =>
      current.some((item) => item.id === latestMessage.id)
        ? current
        : [...current, latestMessage],
    );
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });
  }, [latestMessage]);

  const loadOlderMessages = useCallback(async () => {
    if (
      !session ||
      !conversationId ||
      !isListReady ||
      !hasMoreMessagesRef.current ||
      loadingOlderMessagesRef.current
    ) {
      return;
    }
    const nextPage = pageRef.current + 1;
    loadingOlderMessagesRef.current = true;
    olderContentHeightRef.current = contentHeightRef.current;
    try {
      const data = await listMessages(
        session.accessToken,
        conversationId,
        nextPage,
        MESSAGE_PAGE_SIZE,
      );
      setMessages((current) => {
        const currentIds = new Set(current.map((item) => item.id));
        const olderMessages = data.filter((item) => !currentIds.has(item.id));
        return [...olderMessages, ...current];
      });
      pageRef.current = nextPage;
      hasMoreMessagesRef.current = data.length === MESSAGE_PAGE_SIZE;
    } catch (error) {
      handleApiError(error, { fallback: "消息加载失败", setMessage });
    } finally {
      loadingOlderMessagesRef.current = false;
    }
  }, [conversationId, handleApiError, isListReady, session, setMessage]);

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      const olderContentHeight = olderContentHeightRef.current;
      contentHeightRef.current = height;
      if (olderContentHeight !== null) {
        olderContentHeightRef.current = null;
        const heightDelta = height - olderContentHeight;
        if (heightDelta > 0) {
          requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({
              offset: scrollOffsetRef.current + heightDelta,
              animated: false,
            });
          });
        }
        return;
      }
      if (!isListReady && messages.length) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToEnd({ animated: false });
          requestAnimationFrame(() => setIsListReady(true));
        });
      }
    },
    [isListReady, messages.length],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      if (isListReady && event.nativeEvent.contentOffset.y <= 24) {
        void loadOlderMessages();
      }
    },
    [isListReady, loadOlderMessages],
  );

  const appendMessage = useCallback((message: Message) => {
    setMessages((current) => [...current, message]);
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: false });
    });
  }, []);

  return {
    appendMessage,
    handleContentSizeChange,
    handleScroll,
    isListReady,
    listRef,
    loadLatestMessages,
    messages,
    setMessages,
  };
}
