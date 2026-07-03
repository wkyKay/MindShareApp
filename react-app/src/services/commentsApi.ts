import { API_V1_BASE_URL } from "../config/api";
import { authFetch } from "./apiClient";
import { throwApiError } from "./apiError";

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

export async function getComments(
  postId: number,
  signal?: AbortSignal,
) {
  const response = await authFetch(
    `${API_V1_BASE_URL}/posts/${postId}/comments?page=1&page_size=100`,
    { signal },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as CommentPage;
}

export async function createComment(
  postId: number,
  body: string,
  parentId?: number | null,
) {
  const response = await authFetch(`${API_V1_BASE_URL}/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, parent_id: parentId ?? null }),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as CommentItem;
}

export async function deleteComment(commentId: number) {
  const response = await authFetch(`${API_V1_BASE_URL}/comments/${commentId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    await throwApiError(response);
  }
}

export async function setCommentLiked(
  commentId: number,
  liked: boolean,
) {
  const response = await authFetch(
    `${API_V1_BASE_URL}/comments/${commentId}/like`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liked }),
    },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as { liked: boolean; like_count: number };
}
