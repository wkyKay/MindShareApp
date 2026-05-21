import { API_V1_BASE_URL } from '../config/api';

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
  created_at: string;
};

export type ProfileCollection = {
  id: number;
  title: string;
  description?: string | null;
  cover_url?: string | null;
  item_count?: number;
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

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { detail?: string };
    return data.detail || '请求失败，请稍后重试。';
  } catch {
    return '请求失败，请稍后重试。';
  }
}

async function profileRequest<T>(path: string, accessToken: string) {
  const response = await fetch(`${API_V1_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as T;
}

export function getMyPosts(accessToken: string) {
  return profileRequest<PageResponse<ProfilePost>>('/users/me/posts', accessToken);
}

export function getMyFavorites(accessToken: string) {
  return profileRequest<PageResponse<ProfilePost>>('/users/me/favorites', accessToken);
}

export function getMyCollections(accessToken: string) {
  return profileRequest<PageResponse<ProfileCollection>>('/users/me/collections', accessToken);
}

export function getCollectionDetail(collectionId: number, accessToken: string) {
  return profileRequest<CollectionDetail>(`/collections/${collectionId}`, accessToken);
}

export function getPostDetail(postId: number, accessToken: string) {
  return profileRequest<ProfilePost>(`/posts/${postId}`, accessToken);
}
