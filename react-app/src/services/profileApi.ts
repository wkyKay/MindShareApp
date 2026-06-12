import { API_V1_BASE_URL } from "../config/api";
import { apiFetch, throwApiError } from "./apiError";

export type PageResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

export type ProfilePost = {
  id: number;
  title: string;
  summary?: string | null;
  cover_url?: string | null;
  tags: string[];
  status?: string;
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
  is_deleted: boolean;
  is_owner: boolean;
  created_at: string;
};

export type ProfileCollection = {
  id: number;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  item_count?: number;
  is_favorited?: boolean;
  favorite_type?: "collection";
  owner?: {
    id: number;
    display_name: string;
    avatar_url?: string | null;
  };
};

export type FavoritePost = ProfilePost & { favorite_type?: "post" };
export type ProfileFavorite = FavoritePost | ProfileCollection;

export type FollowingUser = {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  is_following: boolean;
};

export type CollectionDetail = ProfileCollection & {
  owner: {
    id: number;
    display_name: string;
    avatar_url?: string | null;
  };
  items: {
    post_id: number;
    title: string;
    sort_order: number;
  }[];
};

async function profileRequest<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
) {
  const response = await apiFetch(`${API_V1_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function getMyPosts(accessToken: string) {
  return profileRequest<PageResponse<ProfilePost>>(
    "/users/me/posts",
    accessToken,
  );
}

export function getMyFavorites(accessToken: string) {
  return profileRequest<PageResponse<ProfileFavorite>>(
    "/users/me/favorites",
    accessToken,
  );
}

export function getMyCollections(accessToken: string) {
  return profileRequest<PageResponse<ProfileCollection>>(
    "/users/me/collections",
    accessToken,
  );
}

export function getMyFollowing(accessToken: string) {
  return profileRequest<PageResponse<FollowingUser>>(
    "/users/me/following",
    accessToken,
  );
}

export function getCollectionDetail(collectionId: number, accessToken: string) {
  return profileRequest<CollectionDetail>(
    `/collections/${collectionId}`,
    accessToken,
  );
}

export async function getPublicCollectionDetail(
  collectionId: number,
  accessToken?: string,
) {
  const response = await apiFetch(
    `${API_V1_BASE_URL}/collections/${collectionId}`,
    {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    },
  );
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as CollectionDetail;
}

export function getPostDetail(postId: number, accessToken: string) {
  return profileRequest<ProfilePost>(`/posts/${postId}`, accessToken);
}

export async function getPublicPostDetail(
  postId: number,
  accessToken?: string,
) {
  const response = await apiFetch(`${API_V1_BASE_URL}/posts/${postId}`, {
    headers: accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined,
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as ProfilePost;
}

export function createCollection(
  title: string,
  description: string,
  accessToken: string,
) {
  return profileRequest<ProfileCollection>("/collections", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description: description || null,
      visibility: "public",
    }),
  });
}

export function updateCollection(
  collectionId: number,
  title: string,
  description: string,
  accessToken: string,
) {
  return profileRequest<ProfileCollection>(
    `/collections/${collectionId}`,
    accessToken,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: description || null }),
    },
  );
}

export function deleteCollection(collectionId: number, accessToken: string) {
  return profileRequest<void>(`/collections/${collectionId}`, accessToken, {
    method: "DELETE",
  });
}

export function addPostToCollection(
  collectionId: number,
  postId: number,
  accessToken: string,
) {
  return profileRequest<{
    collection_id: number;
    post_id: number;
    sort_order: number;
  }>(`/collections/${collectionId}/items`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post_id: postId, sort_order: 0 }),
  });
}

export function removePostFromCollection(
  collectionId: number,
  postId: number,
  accessToken: string,
) {
  return profileRequest<void>(
    `/collections/${collectionId}/items/${postId}`,
    accessToken,
    { method: "DELETE" },
  );
}

export function setCollectionFavorited(
  collectionId: number,
  favorited: boolean,
  accessToken: string,
) {
  return profileRequest<{ favorited: boolean }>(
    `/collections/${collectionId}/favorite`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorited }),
    },
  );
}
