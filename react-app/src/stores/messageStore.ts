import { create } from "zustand";

import type { AuthSession } from "../services/authSession";
import {
  getMessageUnreadCount,
  getMessagesWebSocketUrl,
  type Message,
  type MessageSocketEvent,
} from "../services/messagesApi";

type MessageStore = {
  unreadCount: number;
  latestMessageByConversation: Record<number, Message>;
  unreadByConversation: Record<number, number>;
  socket: WebSocket | null;
  hydrate: (session: AuthSession | null) => Promise<void>;
  refreshUnreadCount: (session: AuthSession | null) => Promise<void>;
  connect: (session: AuthSession | null) => void;
  disconnect: () => void;
  consumeMessage: (message: Message, currentUserId?: number) => void;
  markConversationRead: (
    session: AuthSession | null,
    conversationId: number,
  ) => Promise<void>;
};

export const useMessageStore = create<MessageStore>((set, get) => ({
  unreadCount: 0,
  latestMessageByConversation: {},
  unreadByConversation: {},
  socket: null,
  async hydrate(session) {
    if (!session) {
      get().disconnect();
      set({
        unreadCount: 0,
        latestMessageByConversation: {},
        unreadByConversation: {},
      });
      return;
    }
    await get().refreshUnreadCount(session);
    get().connect(session);
  },
  async refreshUnreadCount(session) {
    if (!session) {
      set({ unreadCount: 0 });
      return;
    }
    const data = await getMessageUnreadCount(session.accessToken);
    set({ unreadCount: data.unread_count });
  },
  connect(session) {
    if (!session) {
      get().disconnect();
      return;
    }
    const currentSocket = get().socket;
    if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
      return;
    }
    currentSocket?.close();
    const socket = new WebSocket(getMessagesWebSocketUrl(session.accessToken));
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as MessageSocketEvent;
        if (payload.type === "message.created") {
          get().consumeMessage(payload.message, session.user.id);
        }
        if (payload.type === "conversation.read") {
          void get().markConversationRead(session, payload.conversation_id);
        }
      } catch {
        return;
      }
    };
    socket.onclose = () => {
      if (get().socket === socket) {
        set({ socket: null });
      }
    };
    set({ socket });
  },
  disconnect() {
    get().socket?.close();
    set({ socket: null });
  },
  consumeMessage(message, currentUserId) {
    set((state) => ({
      unreadCount:
        message.sender.id === currentUserId
          ? state.unreadCount
          : state.unreadCount + 1,
      unreadByConversation:
        message.sender.id === currentUserId
          ? state.unreadByConversation
          : {
              ...state.unreadByConversation,
              [message.conversation_id]:
                (state.unreadByConversation[message.conversation_id] || 0) + 1,
            },
      latestMessageByConversation: {
        ...state.latestMessageByConversation,
        [message.conversation_id]: message,
      },
    }));
  },
  async markConversationRead(session, conversationId) {
    set((state) => ({
      unreadByConversation: {
        ...state.unreadByConversation,
        [conversationId]: 0,
      },
    }));
    await get().refreshUnreadCount(session);
  },
}));
