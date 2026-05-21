import { API_V1_BASE_URL } from '../config/api';

export type CreatePostPayload = {
  title: string;
  body: string;
  summary?: string;
  tags: string[];
  visibility: 'public' | 'private';
  status: 'published' | 'draft';
};

export type CreatedPost = {
  id: number;
  title: string;
  status: string;
  visibility: string;
  created_at: string;
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

export async function createPost(payload: CreatePostPayload, accessToken: string) {
  const response = await fetch(`${API_V1_BASE_URL}/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as CreatedPost;
}
