import { API_V1_BASE_URL } from "../config/api";
import { apiFetch, throwApiError } from "./apiError";

export type Post = {
  id: number;
  title: string;
  summary?: string | null;
  cover_url?: string | null;
  tags: string[];
  author: {
    id: number;
    display_name: string;
    avatar_url?: string | null;
  };
  like_count: number;
  comment_count: number;
  favorite_count: number;
  is_liked: boolean;
  is_favorited: boolean;
  is_deleted?: boolean;
  is_owner?: boolean;
  created_at: string;
};

export type UserSearchResult = {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  is_following: boolean;
};

type PageResponse = {
  items: Post[];
  page: number;
  page_size: number;
  total: number;
};

export async function getDiscoverPosts(
  page: number = 1,
  pageSize: number = 10,
  seed: number = 1,
  tag?: string | null,
  accessToken?: string,
) {
  const tagParam = tag ? `&tag=${encodeURIComponent(tag)}` : "";
  const response = await apiFetch(
    `${API_V1_BASE_URL}/posts?tab=discover&page=${page}&page_size=${pageSize}&seed=${seed}${tagParam}`,
    {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as PageResponse;
}

export async function searchPostsByTitle(
  query: string,
  accessToken?: string,
  pageSize: number = 5,
  signal?: AbortSignal,
) {
  const response = await apiFetch(
    `${API_V1_BASE_URL}/posts?tab=discover&page=1&page_size=${pageSize}&seed=1&q=${encodeURIComponent(query)}`,
    {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
      signal,
    },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as PageResponse;
}

export async function getTagSuggestions(query: string, signal?: AbortSignal) {
  const response = await apiFetch(
    `${API_V1_BASE_URL}/search/tags?q=${encodeURIComponent(query)}`,
    { signal },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as string[];
}

export async function searchUsers(
  query: string,
  accessToken?: string,
  limit: number = 5,
  signal?: AbortSignal,
) {
  const response = await apiFetch(
    `${API_V1_BASE_URL}/users/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
      signal,
    },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as UserSearchResult[];
}

export async function getFollowingPosts(
  page: number = 1,
  accessToken: string,
  pageSize: number = 10,
) {
  const response = await apiFetch(
    `${API_V1_BASE_URL}/posts?tab=following&page=${page}&page_size=${pageSize}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as PageResponse;
}
