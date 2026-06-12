import { API_BASE_URL, API_V1_BASE_URL } from "../config/api";
import { apiFetch, throwApiError } from "./apiError";

export type AuthMode = "login" | "register";

export type CaptchaResponse = {
  captcha_key: string;
  image_url: string;
  expires_in: number;
};

export type LoginPayload = {
  account: string;
  password: string;
  captcha_key: string;
  captcha_code: string;
};

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
  display_name: string;
  captcha_key: string;
  captcha_code: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  background_url?: string | null;
  bio?: string | null;
};

export type UpdateMePayload = {
  username?: string;
  email?: string;
  display_name?: string;
  bio?: string | null;
  avatar_asset_id?: number;
  background_asset_id?: number;
  password?: string;
};

async function apiRequest<T>(path: string, options?: RequestInit) {
  const response = await apiFetch(`${API_V1_BASE_URL}${path}`, options);
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as T;
}

export function getCaptcha(purpose: AuthMode) {
  return apiRequest<CaptchaResponse>(`/auth/captcha?purpose=${purpose}`);
}

export function login(payload: LoginPayload) {
  return apiRequest<TokenResponse>("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function register(payload: RegisterPayload) {
  return apiRequest<TokenResponse>("/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function getMe(accessToken: string) {
  return apiRequest<AuthUser>("/auth/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }).then(normalizeAuthUser);
}

export function updateMe(payload: UpdateMePayload, accessToken: string) {
  return apiRequest<AuthUser>("/users/me", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).then(normalizeAuthUser);
}

function normalizeAuthUser(user: AuthUser) {
  return {
    ...user,
    avatar_url: normalizeAssetUrl(user.avatar_url),
    background_url: normalizeAssetUrl(user.background_url),
  };
}

function normalizeAssetUrl(url?: string | null) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}
