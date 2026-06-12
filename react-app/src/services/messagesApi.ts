import { API_BASE_URL, API_V1_BASE_URL } from "../config/api";
import { apiFetch, throwApiError } from "./apiError";
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

function authHeaders(accessToken: string, contentType = false) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(contentType ? { "Content-Type": "application/json" } : {}),
  };
}

export async function listConversations(accessToken: string) {
  const response = await apiFetch(`${API_V1_BASE_URL}/messages/conversations`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) await throwApiError(response);
  return (await response.json()) as ConversationItem[];
}

export async function createOrGetConversation(
  accessToken: string,
  partnerId: number,
) {
  const response = await apiFetch(`${API_V1_BASE_URL}/messages/conversations`, {
    method: "POST",
    headers: authHeaders(accessToken, true),
    body: JSON.stringify({ partner_id: partnerId }),
  });
  if (!response.ok) await throwApiError(response);
  return (await response.json()) as ConversationSummary;
}

export async function listMessages(
  accessToken: string,
  conversationId: number,
  page = 1,
  pageSize = 50,
) {
  const response = await apiFetch(
    `${API_V1_BASE_URL}/messages/conversations/${conversationId}/messages?page=${page}&page_size=${pageSize}`,
    {
      headers: authHeaders(accessToken),
    },
  );
  if (!response.ok) await throwApiError(response);
  return (await response.json()) as Message[];
}

export async function sendMessage(
  accessToken: string,
  conversationId: number,
  body: string,
) {
  const response = await apiFetch(
    `${API_V1_BASE_URL}/messages/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ body }),
    },
  );
  if (!response.ok) await throwApiError(response);
  return (await response.json()) as Message;
}

export async function markConversationRead(
  accessToken: string,
  conversationId: number,
) {
  const response = await apiFetch(
    `${API_V1_BASE_URL}/messages/conversations/${conversationId}/read`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
    },
  );
  if (!response.ok) await throwApiError(response);
}

export async function deleteConversation(
  accessToken: string,
  conversationId: number,
) {
  const response = await apiFetch(
    `${API_V1_BASE_URL}/messages/conversations/${conversationId}`,
    {
      method: "DELETE",
      headers: authHeaders(accessToken),
    },
  );
  if (!response.ok) await throwApiError(response);
}

export async function getMessageUnreadCount(accessToken: string) {
  const response = await apiFetch(`${API_V1_BASE_URL}/messages/unread-count`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) await throwApiError(response);
  return (await response.json()) as { unread_count: number };
}

export async function searchUsers(accessToken: string, query: string) {
  const response = await apiFetch(
    `${API_V1_BASE_URL}/users/search?q=${encodeURIComponent(query)}&limit=20`,
    {
      headers: authHeaders(accessToken),
    },
  );
  if (!response.ok) await throwApiError(response);
  return (await response.json()) as SearchUserItem[];
}

export async function getFollowingUsers(accessToken: string) {
  const data = await getMyFollowing(accessToken);
  return data.items as FollowingUser[];
}

export function getMessagesWebSocketUrl(accessToken: string) {
  const wsBaseUrl = API_BASE_URL.replace(/^http/i, "ws");
  return `${wsBaseUrl}/api/v1/messages/ws?token=${encodeURIComponent(accessToken)}`;
}
