import { Platform } from "react-native";

import { API_BASE_URL, API_V1_BASE_URL } from "../config/api";
import { apiFetch, throwApiError } from "./apiError";

export const MAX_POST_BODY_LENGTH = 200_000;

export type CreatePostPayload = {
  title: string;
  body: string;
  summary?: string;
  image_asset_ids?: number[];
  document_asset_ids?: number[];
  tags: string[];
  visibility: "public" | "private";
  status: "published" | "draft";
};

export type CreatedPost = {
  id: number;
  title: string;
  status: string;
  visibility: string;
  created_at: string;
};

export type PostedImage = {
  url: string;
  thumbnail_url?: string | null;
};

export type PostDetail = {
  id: number;
  title: string;
  summary?: string | null;
  body: string;
  cover_url?: string | null;
  image_urls: PostedImage[];
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
  thumbnail_url?: string | null;
};

export type UploadedDocument = UploadedImage;

export type ParsedDocument = {
  asset_id: number;
  original_name: string;
  parse_status: string;
  extracted_text?: string | null;
};

export async function createPost(
  payload: CreatePostPayload,
  accessToken: string,
) {
  const response = await apiFetch(`${API_V1_BASE_URL}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as CreatedPost;
}

function authHeaders(accessToken?: string) {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

export async function getPost(postId: number, accessToken?: string) {
  const response = await apiFetch(`${API_V1_BASE_URL}/posts/${postId}`, {
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  const post = (await response.json()) as PostDetail;
  return {
    ...post,
    body: normalizeMarkdownAssetUrls(post.body),
    cover_url: normalizeAssetUrl(post.cover_url),
    image_urls: post.image_urls.map((img) => ({
      url: normalizeAssetUrl(img.url) || img.url,
      thumbnail_url: normalizeAssetUrl(img.thumbnail_url),
    })),
  };
}

export async function updatePost(
  postId: number,
  payload: UpdatePostPayload,
  accessToken: string,
) {
  const response = await apiFetch(`${API_V1_BASE_URL}/posts/${postId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as CreatedPost;
}

export async function deletePost(postId: number, accessToken: string) {
  const response = await apiFetch(`${API_V1_BASE_URL}/posts/${postId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    await throwApiError(response);
  }
}

export async function setPostLiked(
  postId: number,
  liked: boolean,
  accessToken: string,
) {
  const response = await apiFetch(`${API_V1_BASE_URL}/posts/${postId}/like`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ liked }),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as LikeResponse;
}

export async function setPostFavorited(
  postId: number,
  favorited: boolean,
  accessToken: string,
) {
  const response = await apiFetch(`${API_V1_BASE_URL}/posts/${postId}/favorite`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ favorited }),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as FavoriteResponse;
}

export async function dislikePost(postId: number, accessToken: string) {
  const response = await apiFetch(`${API_V1_BASE_URL}/posts/${postId}/dislike`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as { disliked: boolean };
}

export async function uploadPostImage(
  uri: string,
  fileName: string,
  accessToken: string,
  kind: "image" | "cover" | "avatar" = "image",
  onProgress?: (pct: number) => void,
) {
  const formData = new FormData();
  formData.append("kind", kind);
  const imageFile = await createUploadFile(
    uri,
    fileName,
    guessMimeType(fileName, "image/jpeg"),
  );
  formData.append("file", imageFile);

  const baseUrl = `${API_V1_BASE_URL}/uploads/images`;

  return new Promise<UploadedImage & { url?: string | null; thumbnail_url?: string | null }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", baseUrl);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const uploaded = JSON.parse(xhr.responseText) as UploadedImage;
          resolve({
            ...uploaded,
            url: normalizeAssetUrl(uploaded.url),
            thumbnail_url: uploaded.thumbnail_url
              ? normalizeAssetUrl(uploaded.thumbnail_url)
              : undefined,
          });
        } catch {
          reject(new Error("服务端返回了无法解析的响应。"));
        }
      } else {
        try {
          const errorBody = JSON.parse(xhr.responseText);
          reject(new Error(errorBody.detail || `上传失败，状态码 ${xhr.status}`));
        } catch {
          reject(new Error(`上传失败，状态码 ${xhr.status}`));
        }
      }
    };
    xhr.onerror = () => reject(new Error("网络错误，上传失败。"));
    xhr.ontimeout = () => reject(new Error("上传超时。"));
    xhr.send(formData);
  });
}

export async function uploadPostDocument(
  uri: string,
  fileName: string,
  accessToken: string,
  mimeType?: string | null,
) {
  const formData = new FormData();
  formData.append("kind", "document");
  const documentFile = await createUploadFile(
    uri,
    fileName,
    mimeType || undefined,
  );
  formData.append("file", documentFile);

  const response = await apiFetch(`${API_V1_BASE_URL}/uploads/documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  const uploaded = (await response.json()) as UploadedDocument;
  return {
    ...uploaded,
    url: normalizeAssetUrl(uploaded.url),
  };
}

export async function parsePostDocument(
  uri: string,
  fileName: string,
  accessToken: string,
  mimeType?: string | null,
) {
  const formData = new FormData();
  const documentFile = await createUploadFile(
    uri,
    fileName,
    mimeType || undefined,
  );
  formData.append("file", documentFile);

  const response = await apiFetch(`${API_V1_BASE_URL}/uploads/parse-document`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as ParsedDocument;
}

async function createUploadFile(
  uri: string,
  fileName: string,
  mimeType?: string,
) {
  if (Platform.OS !== "web") {
    return {
      uri,
      name: fileName,
      type: mimeType || guessMimeType(fileName, "application/octet-stream"),
    } as unknown as Blob;
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  return new File([blob], fileName, {
    type: mimeType || blob.type || "application/octet-stream",
  });
}

function guessMimeType(fileName: string, fallback: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "pdf") return "application/pdf";
  if (ext === "doc") return "application/msword";
  if (ext === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "md") return "text/markdown";
  return fallback;
}

function normalizeAssetUrl(url?: string | null) {
  if (!url) {
    return url;
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function normalizeMarkdownAssetUrls(markdown: string) {
  return markdown.replace(
    /!\[([^\]]*)\]\((\/uploads\/[^)]+)\)/g,
    (_match, altText, relativeUrl) => {
      return `![${altText}](${normalizeAssetUrl(relativeUrl)})`;
    },
  );
}
