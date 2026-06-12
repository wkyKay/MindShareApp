import { API_V1_BASE_URL } from "../config/api";
import { apiFetch, throwApiError } from "./apiError";

export type CommentItem = {
  id: number;
  body: string;
  author: {
    id: number;
    display_name: string;
    avatar_url?: string | null;
  } | null;
  parent_id?: number | null;
  created_at: string;
  like_count: number;
  is_liked: boolean;
};

export type CommentPage = {
  items: CommentItem[];
  page: number;
  page_size: number;
  total: number;
};

function authHeaders(accessToken?: string, contentType = false) {
  if (!accessToken && !contentType) return undefined;
  return {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(contentType ? { "Content-Type": "application/json" } : {}),
  };
}

export async function getComments(postId: number, accessToken?: string) {
  const response = await apiFetch(
    `${API_V1_BASE_URL}/posts/${postId}/comments?page=1&page_size=100`,
    {
      headers: authHeaders(accessToken),
    },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as CommentPage;
}

export async function createComment(
  postId: number,
  body: string,
  accessToken: string,
  parentId?: number | null,
) {
  const response = await apiFetch(`${API_V1_BASE_URL}/posts/${postId}/comments`, {
    method: "POST",
    headers: authHeaders(accessToken, true),
    body: JSON.stringify({ body, parent_id: parentId ?? null }),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as CommentItem;
}

export async function deleteComment(commentId: number, accessToken: string) {
  const response = await apiFetch(`${API_V1_BASE_URL}/comments/${commentId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
}

export async function setCommentLiked(
  commentId: number,
  liked: boolean,
  accessToken: string,
) {
  const response = await apiFetch(
    `${API_V1_BASE_URL}/comments/${commentId}/like`,
    {
      method: "POST",
      headers: authHeaders(accessToken, true),
      body: JSON.stringify({ liked }),
    },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as { liked: boolean; like_count: number };
}
