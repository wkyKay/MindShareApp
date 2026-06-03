import { API_V1_BASE_URL } from '../config/api';

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

type PageResponse = {
  items: Post[];
  page: number;
  page_size: number;
  total: number;
};

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { detail?: string | { msg?: string }[] };
    if (typeof data.detail === 'string') {
      return data.detail;
    }
    if (Array.isArray(data.detail) && data.detail[0]?.msg) {
      return data.detail[0].msg;
    }
  } catch {
    return '请求失败，请稍后重试。';
  }
  return '请求失败，请稍后重试。';
}

export async function getDiscoverPosts(page: number = 1, pageSize: number = 10, seed: number = 1, tag?: string | null, accessToken?: string) {
  const tagParam = tag ? `&tag=${encodeURIComponent(tag)}` : '';
  const response = await fetch(
    `${API_V1_BASE_URL}/posts?tab=discover&page=${page}&page_size=${pageSize}&seed=${seed}${tagParam}`,
    {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    }
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PageResponse;
}

export async function getTagSuggestions(query: string) {
  const response = await fetch(`${API_V1_BASE_URL}/search/tags?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as string[];
}

export async function getFollowingPosts(page: number = 1, accessToken: string, pageSize: number = 10) {
  const response = await fetch(
    `${API_V1_BASE_URL}/posts?tab=following&page=${page}&page_size=${pageSize}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PageResponse;
}
