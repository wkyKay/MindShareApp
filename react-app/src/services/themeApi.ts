import { API_V1_BASE_URL } from "../config/api";
import type { PartialThemeColors } from "../theme/ThemeProvider";
import { createApiErrorFromBody, createNetworkApiError } from "./apiError";

export type ThemeMode = "light" | "dark";

export type ThemeResponse = {
  light: PartialThemeColors | null;
  dark: PartialThemeColors | null;
};

async function parseJsonOrThrow(response: Response) {
  if (response.status >= 400) {
    const text = await response.text();
    try {
      throw createApiErrorFromBody(response.status, JSON.parse(text));
    } catch {
      throw createApiErrorFromBody(response.status, undefined);
    }
  }
  return response.json();
}

/** 获取当前用户的自定义主题 */
export async function fetchUserTheme(accessToken: string): Promise<ThemeResponse> {
  const response = await fetch(`${API_V1_BASE_URL}/theme`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const data = await parseJsonOrThrow(response);
  return {
    light: data.light ?? null,
    dark: data.dark ?? null,
  };
}

/** 应用（增量保存）用户自定义主题 */
export async function applyTheme(
  accessToken: string,
  theme: PartialThemeColors,
  mode: ThemeMode,
): Promise<ThemeResponse> {
  const response = await fetch(`${API_V1_BASE_URL}/theme/apply`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ theme, mode }),
  });
  const data = await parseJsonOrThrow(response);
  return {
    light: data.light ?? null,
    dark: data.dark ?? null,
  };
}

/** 重置用户自定义主题 */
export async function resetTheme(
  accessToken: string,
  mode: ThemeMode | "all",
): Promise<ThemeResponse> {
  const response = await fetch(`${API_V1_BASE_URL}/theme`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode }),
  });
  const data = await parseJsonOrThrow(response);
  return {
    light: data.light ?? null,
    dark: data.dark ?? null,
  };
}
