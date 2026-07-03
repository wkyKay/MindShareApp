import { API_BASE_URL, API_V1_BASE_URL } from "../config/api";
import { authFetch } from "./apiClient";
import { throwApiError } from "./apiError";
import { loadAuthSession } from "./authSession";
import { getMyFollowing, type FollowingUser } from "./profileApi";

export type MessageUserSummary = {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string | null;
};

export type Message = {
  id: number;
  conversation_id: number;
  sender: MessageUserSummary;
  body: string;
  status: string;
  created_at: string;
};

export type MessageSocketEvent =
  | { type: "message.created"; message: Message }
  | { type: "conversation.read"; conversation_id: number };

export type ConversationItem = {
  id: number;
  partner: MessageUserSummary;
  last_message?: Message | null;
  unread_count: number;
  updated_at: string;
};

export type ConversationSummary = {
  id: number;
  partner: MessageUserSummary;
  unread_count: number;
};

export type SearchUserItem = {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  is_following: boolean;
};

export async function listConversations() {
  const response = await authFetch(`${API_V1_BASE_URL}/messages/conversations`);
  if (!response.ok) await throwApiError(response);
  return (await response.json()) as ConversationItem[];
}

export async function createOrGetConversation(
  partnerId: number,
) {
  const response = await authFetch(`${API_V1_BASE_URL}/messages/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partner_id: partnerId }),
  });
  if (!response.ok) await throwApiError(response);
  return (await response.json()) as ConversationSummary;
}

export async function listMessages(
  conversationId: number,
  page = 1,
  pageSize = 50,
) {
  const response = await authFetch(
    `${API_V1_BASE_URL}/messages/conversations/${conversationId}/messages?page=${page}&page_size=${pageSize}`,
  );
  if (!response.ok) await throwApiError(response);
  return (await response.json()) as Message[];
}

export async function sendMessage(
  conversationId: number,
  body: string,
) {
  const response = await authFetch(
    `${API_V1_BASE_URL}/messages/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) await throwApiError(response);
  return (await response.json()) as Message;
}

export async function markConversationRead(
  conversationId: number,
) {
  const response = await authFetch(
    `${API_V1_BASE_URL}/messages/conversations/${conversationId}/read`,
    {
      method: "POST",
    },
  );
  if (!response.ok) await throwApiError(response);
}

export async function deleteConversation(
  conversationId: number,
) {
  const response = await authFetch(
    `${API_V1_BASE_URL}/messages/conversations/${conversationId}`,
    {
      method: "DELETE",
    },
  );
  if (!response.ok) await throwApiError(response);
}

export async function getMessageUnreadCount() {
  const response = await authFetch(`${API_V1_BASE_URL}/messages/unread-count`);
  if (!response.ok) await throwApiError(response);
  return (await response.json()) as { unread_count: number };
}

export async function searchUsers(query: string) {
  const response = await authFetch(
    `${API_V1_BASE_URL}/users/search?q=${encodeURIComponent(query)}&limit=20`,
  );
  if (!response.ok) await throwApiError(response);
  return (await response.json()) as SearchUserItem[];
}

export async function getFollowingUsers() {
  const session = await loadAuthSession();
  const accessToken = session?.accessToken ?? "";
  const data = await getMyFollowing();
  return data.items as FollowingUser[];
}

export async function getMessagesWebSocketUrl() {
  const session = await loadAuthSession();
  const accessToken = session?.accessToken ?? "";
  const wsBaseUrl = API_BASE_URL.replace(/^http/i, "ws");
  return `${wsBaseUrl}/api/v1/messages/ws?token=${encodeURIComponent(accessToken)}`;
}
