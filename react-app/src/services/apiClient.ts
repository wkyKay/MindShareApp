import { API_V1_BASE_URL } from "../config/api";
import { apiFetch, type ApiError } from "./apiError";
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  type AuthSession,
} from "./authSession";

// 静默刷新状态管理 —— 防并发刷新
let isRefreshing = false;
let pendingRefresh: Promise<AuthSession | null> | null = null;

/**
 * 用当前 refresh_token 向 /auth/refresh 换取新的 token 对。
 * 使用原始 apiFetch（不经 authFetch）避免循环依赖。
 */
async function refreshTokens(): Promise<AuthSession | null> {
  const session = await loadAuthSession();
  if (!session?.refreshToken) {
    return null;
  }

  const response = await apiFetch(`${API_V1_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });

  if (!response.ok) {
    await clearAuthSession();
    return null;
  }

  const tokenResponse = await response.json();
  return saveAuthSession(tokenResponse);
}

/**
 * 带自动 Auth 头的 fetch 封装。
 * - 自动从 AsyncStorage 读取 access_token 并注入 Authorization header
 * - 收到 401 时自动用 refresh_token 静默续期，然后重试原请求
 * - 续期失败时清空 session（后续由 UI 层引导登录）
 *
 * 与 apiFetch 相同：返回 Response，不自动抛异常。调用方仍然自己检查 .ok。
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const session = await loadAuthSession();

  const headers = new Headers(init?.headers);
  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  let response = await apiFetch(input, { ...init, headers });

  // 401 → 尝试静默刷新
  if (response.status === 401 && session?.refreshToken) {
    if (!isRefreshing) {
      isRefreshing = true;
      pendingRefresh = refreshTokens().finally(() => {
        isRefreshing = false;
        pendingRefresh = null;
      });
    }

    const newSession = await pendingRefresh;
    if (newSession) {
      headers.set("Authorization", `Bearer ${newSession.accessToken}`);
      response = await apiFetch(input, { ...init, headers });
    }
  }

  return response;
}

/**
 * 主动刷新 token（用于 App 从后台切回前台等场景）。
 * 返回新 session 或 null。
 */
export function refreshAuthTokens(): Promise<AuthSession | null> {
  if (pendingRefresh) return pendingRefresh;
  return refreshTokens();
}
