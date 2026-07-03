import { API_BASE_URL, API_V1_BASE_URL } from "../config/api";
import { authFetch } from "./apiClient";
import { throwApiError } from "./apiError";
import { loadAuthSession } from "./authSession";

export type NotificationItem = {
  id: number;
  type:
    | "comment_created"
    | "comment_reply"
    | "comment_liked"
    | "post_liked"
    | "post_favorited"
    | "collection_favorited"
    | "user_followed";
  recipient_id: number;
  actor: {
    id: number;
    display_name: string;
    avatar_url?: string | null;
  };
  post_id: number;
  post_title?: string | null;
  comment_id: number;
  parent_comment_id?: number | null;
  target_user_id?: number | null;
  is_read: boolean;
  created_at: string;
};

export type PostUnreadCount = {
  post_id: number;
  unread_count: number;
};

export type NotificationPage = {
  items: NotificationItem[];
  page: number;
  page_size: number;
  total: number;
};

export async function getNotificationUnreadCount() {
  const response = await authFetch(
    `${API_V1_BASE_URL}/notifications/unread-count`,
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as { unread_count: number };
}

export async function listNotifications() {
  const response = await authFetch(
    `${API_V1_BASE_URL}/notifications?page=1&page_size=100`,
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as NotificationPage;
}

export async function getPostUnreadCounts() {
  const response = await authFetch(
    `${API_V1_BASE_URL}/notifications/posts/unread`,
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as PostUnreadCount[];
}

export async function markNotificationsRead(
  options: { postId?: number; notificationId?: number } = {},
) {
  const response = await authFetch(`${API_V1_BASE_URL}/notifications/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      post_id: options.postId ?? null,
      notification_id: options.notificationId ?? null,
    }),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
}

export async function getNotificationsWebSocketUrl() {
  const session = await loadAuthSession();
  const accessToken = session?.accessToken ?? "";
  const wsBaseUrl = API_BASE_URL.replace(/^http/i, "ws");
  return `${wsBaseUrl}/api/v1/notifications/ws?token=${encodeURIComponent(accessToken)}`;
}
