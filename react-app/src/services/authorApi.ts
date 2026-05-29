import { API_V1_BASE_URL } from '../config/api';
import type { PageResponse, ProfilePost, ProfileCollection } from './profileApi';

export type { ProfilePost, ProfileCollection };

export type AuthorInfo = {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string | null;
  is_following: boolean;
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

export async function getAuthorInfo(authorId: number, accessToken?: string) {
  const response = await fetch(`${API_V1_BASE_URL}/users/${authorId}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as AuthorInfo;
}

export async function setAuthorFollowing(authorId: number, accessToken: string, following: boolean) {
  const response = await fetch(`${API_V1_BASE_URL}/users/${authorId}/follow`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ following }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as { following: boolean };
}

export async function getAuthorPosts(authorId: number, page: number = 1, pageSize: number = 20) {
  const response = await fetch(`${API_V1_BASE_URL}/users/${authorId}/posts?page=${page}&page_size=${pageSize}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PageResponse<ProfilePost>;
}

export async function getAuthorCollections(authorId: number, accessToken?: string) {
  const response = await fetch(`${API_V1_BASE_URL}/users/${authorId}/collections`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const data = (await response.json()) as { items: ProfileCollection[] };
  return data.items;
}
