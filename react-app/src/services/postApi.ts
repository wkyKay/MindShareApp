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

export type PostDetail = {
  id: number;
  title: string;
  summary?: string | null;
  body: string;
  cover_url?: string | null;
  image_urls: string[];
  tags: string[];
  status: string;
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
  updated_at: string;
};

export type UpdatePostPayload = Partial<CreatePostPayload>;

export type LikeResponse = {
  liked: boolean;
  like_count: number;
};

export type FavoriteResponse = {
  favorited: boolean;
  favorite_count: number;
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

function authHeaders(accessToken?: string) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

export async function getPost(postId: number, accessToken?: string) {
  const response = await fetch(`${API_V1_BASE_URL}/posts/${postId}`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PostDetail;
}

export async function updatePost(postId: number, payload: UpdatePostPayload, accessToken: string) {
  const response = await fetch(`${API_V1_BASE_URL}/posts/${postId}`, {
    method: 'PATCH',
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

export async function deletePost(postId: number, accessToken: string) {
  const response = await fetch(`${API_V1_BASE_URL}/posts/${postId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function setPostLiked(postId: number, liked: boolean, accessToken: string) {
  const response = await fetch(`${API_V1_BASE_URL}/posts/${postId}/like`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ liked }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as LikeResponse;
}

export async function setPostFavorited(postId: number, favorited: boolean, accessToken: string) {
  const response = await fetch(`${API_V1_BASE_URL}/posts/${postId}/favorite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ favorited }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as FavoriteResponse;
}
