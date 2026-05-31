import { API_BASE_URL, API_V1_BASE_URL } from '../config/api';

export type NotificationItem = {
  id: number;
  type: 'comment_created' | 'comment_reply' | 'comment_liked' | 'post_liked' | 'post_favorited' | 'collection_favorited' | 'user_followed';
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

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { detail?: string };
    return data.detail || '请求失败，请稍后重试。';
  } catch {
    return '请求失败，请稍后重试。';
  }
}

export async function getNotificationUnreadCount(accessToken: string) {
  const response = await fetch(`${API_V1_BASE_URL}/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as { unread_count: number };
}

export async function listNotifications(accessToken: string) {
  const response = await fetch(`${API_V1_BASE_URL}/notifications?page=1&page_size=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as NotificationPage;
}

export async function getPostUnreadCounts(accessToken: string) {
  const response = await fetch(`${API_V1_BASE_URL}/notifications/posts/unread`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PostUnreadCount[];
}

export async function markNotificationsRead(accessToken: string, options: { postId?: number; notificationId?: number } = {}) {
  const response = await fetch(`${API_V1_BASE_URL}/notifications/read`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ post_id: options.postId ?? null, notification_id: options.notificationId ?? null }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export function getNotificationsWebSocketUrl(accessToken: string) {
  const wsBaseUrl = API_BASE_URL.replace(/^http/i, 'ws');
  return `${wsBaseUrl}/api/v1/notifications/ws?token=${encodeURIComponent(accessToken)}`;
}
