import { API_V1_BASE_URL } from "../config/api";

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
  bio?: string | null;
};

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as {
      detail?: string | { msg?: string }[];
    };
    if (typeof data.detail === "string") {
      return data.detail;
    }
    if (Array.isArray(data.detail) && data.detail[0]?.msg) {
      return data.detail[0].msg;
    }
  } catch {
    return i18n.t("请求失败，请稍后重试。");
  }
  return i18n.t("请求失败，请稍后重试。");
}

async function apiRequest<T>(path: string, options?: RequestInit) {
  const response = await fetch(`${API_V1_BASE_URL}${path}`, options);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
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
  });
}
import i18n from "../i18n";
