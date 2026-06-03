import { Platform } from 'react-native';

import { API_BASE_URL, API_V1_BASE_URL } from '../config/api';

export type CreatePostPayload = {
  title: string;
  body: string;
  summary?: string;
  image_asset_ids?: number[];
  document_asset_ids?: number[];
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

export type UploadedImage = {
  id: number;
  kind: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  url?: string | null;
};

export type UploadedDocument = UploadedImage;

export type ParsedDocument = {
  asset_id: number;
  original_name: string;
  parse_status: string;
  extracted_text?: string | null;
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
  const post = (await response.json()) as PostDetail;
  return {
    ...post,
    body: normalizeMarkdownAssetUrls(post.body),
    cover_url: normalizeAssetUrl(post.cover_url),
    image_urls: post.image_urls.map((url) => normalizeAssetUrl(url) || url),
  };
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

export async function dislikePost(postId: number, accessToken: string) {
  const response = await fetch(`${API_V1_BASE_URL}/posts/${postId}/dislike`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as { disliked: boolean };
}

export async function uploadPostImage(uri: string, fileName: string, accessToken: string) {
  const formData = new FormData();
  formData.append('kind', 'image');
  const imageFile = await createUploadFile(uri, fileName, guessMimeType(fileName, 'image/jpeg'));
  formData.append('file', imageFile);

  const response = await fetch(`${API_V1_BASE_URL}/uploads/images`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const uploaded = (await response.json()) as UploadedImage;
  return {
    ...uploaded,
    url: normalizeAssetUrl(uploaded.url),
  };
}

export async function uploadPostDocument(uri: string, fileName: string, accessToken: string, mimeType?: string | null) {
  const formData = new FormData();
  formData.append('kind', 'document');
  const documentFile = await createUploadFile(uri, fileName, mimeType || undefined);
  formData.append('file', documentFile);

  const response = await fetch(`${API_V1_BASE_URL}/uploads/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const uploaded = (await response.json()) as UploadedDocument;
  return {
    ...uploaded,
    url: normalizeAssetUrl(uploaded.url),
  };
}

export async function parsePostDocument(uri: string, fileName: string, accessToken: string, mimeType?: string | null) {
  const formData = new FormData();
  const documentFile = await createUploadFile(uri, fileName, mimeType || undefined);
  formData.append('file', documentFile);

  const response = await fetch(`${API_V1_BASE_URL}/uploads/parse-document`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as ParsedDocument;
}

async function createUploadFile(uri: string, fileName: string, mimeType?: string) {
  if (Platform.OS !== 'web') {
    return {
      uri,
      name: fileName,
      type: mimeType || guessMimeType(fileName, 'application/octet-stream'),
    } as unknown as Blob;
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  return new File([blob], fileName, { type: mimeType || blob.type || 'application/octet-stream' });
}

function guessMimeType(fileName: string, fallback: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'md') return 'text/markdown';
  return fallback;
}

function normalizeAssetUrl(url?: string | null) {
  if (!url) {
    return url;
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function normalizeMarkdownAssetUrls(markdown: string) {
  return markdown.replace(/!\[([^\]]*)\]\((\/uploads\/[^)]+)\)/g, (_match, altText, relativeUrl) => {
    return `![${altText}](${normalizeAssetUrl(relativeUrl)})`;
  });
}
