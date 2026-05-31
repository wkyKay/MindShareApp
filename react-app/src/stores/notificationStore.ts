import { create } from 'zustand';

import type { AuthSession } from '../services/authSession';
import {
  getNotificationUnreadCount,
  getNotificationsWebSocketUrl,
  getPostUnreadCounts,
  listNotifications,
  markNotificationsRead,
  type NotificationItem,
} from '../services/notificationsApi';

type NotificationStore = {
  unreadCount: number;
  unreadByPostId: Record<number, number>;
  notifications: NotificationItem[];
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected';
  socket: WebSocket | null;
  hydrate: (session: AuthSession | null) => Promise<void>;
  connect: (session: AuthSession | null) => void;
  disconnect: () => void;
  refreshNotifications: (session: AuthSession | null) => Promise<void>;
  markPostRead: (session: AuthSession | null, postId: number) => Promise<void>;
  markNotificationRead: (session: AuthSession | null, notificationId: number) => Promise<void>;
  consumeNotification: (notification: NotificationItem) => void;
};

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  unreadCount: 0,
  unreadByPostId: {},
  notifications: [],
  connectionStatus: 'idle',
  socket: null,
  async hydrate(session) {
    if (!session) {
      get().disconnect();
      set({ unreadCount: 0, unreadByPostId: {}, notifications: [], connectionStatus: 'idle' });
      return;
    }
    const [unreadCountData, postUnreadCounts, notificationPage] = await Promise.all([
      getNotificationUnreadCount(session.accessToken),
      getPostUnreadCounts(session.accessToken),
      listNotifications(session.accessToken),
    ]);
    set({
      unreadCount: unreadCountData.unread_count,
      unreadByPostId: Object.fromEntries(postUnreadCounts.map((item) => [item.post_id, item.unread_count])),
      notifications: notificationPage.items,
    });
    get().connect(session);
  },
  connect(session) {
    if (!session) {
      get().disconnect();
      return;
    }
    const currentSocket = get().socket;
    if (currentSocket && get().connectionStatus === 'connected') {
      return;
    }
    currentSocket?.close();
    set({ connectionStatus: 'connecting' });
    const socket = new WebSocket(getNotificationsWebSocketUrl(session.accessToken));
    socket.onopen = () => {
      set({ connectionStatus: 'connected', socket });
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as { type?: string; notification?: NotificationItem };
        if (payload.type === 'notification.created' && payload.notification) {
          get().consumeNotification(payload.notification);
        }
      } catch {
        return;
      }
    };
    socket.onerror = () => {
      set({ connectionStatus: 'disconnected' });
    };
    socket.onclose = () => {
      if (get().socket === socket) {
        set({ socket: null, connectionStatus: 'disconnected' });
      }
    };
    set({ socket });
  },
  disconnect() {
    const socket = get().socket;
    socket?.close();
    set({ socket: null, connectionStatus: 'disconnected' });
  },
  async refreshNotifications(session) {
    if (!session) {
      set({ notifications: [] });
      return;
    }
    const notificationPage = await listNotifications(session.accessToken);
    set({ notifications: notificationPage.items });
  },
  async markPostRead(session, postId) {
    if (!session) {
      return;
    }
    const currentCount = get().unreadByPostId[postId] || 0;
    if (!currentCount) {
      return;
    }
    await markNotificationsRead(session.accessToken, { postId });
    set((state) => ({
      unreadCount: Math.max(0, state.unreadCount - currentCount),
      unreadByPostId: { ...state.unreadByPostId, [postId]: 0 },
      notifications: state.notifications.map((item) => item.post_id === postId ? { ...item, is_read: true } : item),
    }));
  },
  async markNotificationRead(session, notificationId) {
    if (!session) {
      return;
    }
    const notification = get().notifications.find((item) => item.id === notificationId);
    if (!notification || notification.is_read) {
      return;
    }
    await markNotificationsRead(session.accessToken, { notificationId });
    set((state) => ({
      unreadCount: Math.max(0, state.unreadCount - 1),
      unreadByPostId: notification.post_id > 0
        ? { ...state.unreadByPostId, [notification.post_id]: Math.max(0, (state.unreadByPostId[notification.post_id] || 0) - 1) }
        : state.unreadByPostId,
      notifications: state.notifications.map((item) => item.id === notificationId ? { ...item, is_read: true } : item),
    }));
  },
  consumeNotification(notification) {
    set((state) => ({
      unreadCount: state.unreadCount + 1,
      unreadByPostId: {
        ...state.unreadByPostId,
        [notification.post_id]: (state.unreadByPostId[notification.post_id] || 0) + 1,
      },
      notifications: [notification, ...state.notifications],
    }));
  },
}));
