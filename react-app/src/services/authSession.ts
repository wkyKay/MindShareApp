import AsyncStorage from "@react-native-async-storage/async-storage";

import { getMe, type AuthUser, type TokenResponse } from "./authApi";

const AUTH_SESSION_KEY = "auth.session.v1";

export type AuthSession = {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
};

export async function saveAuthSession(tokenResponse: TokenResponse) {
  const session: AuthSession = {
    accessToken: tokenResponse.access_token,
    tokenType: tokenResponse.token_type,
    user: tokenResponse.user,
  };

  await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function loadAuthSession() {
  const rawSession = await AsyncStorage.getItem(AUTH_SESSION_KEY);
  if (!rawSession) {
    return null;
  }

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    await clearAuthSession();
    return null;
  }
}

export async function refreshAuthSession() {
  const session = await loadAuthSession();
  if (!session) {
    return null;
  }

  const user = await getMe(session.accessToken);
  const refreshedSession = { ...session, user };
  await AsyncStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify(refreshedSession),
  );
  return refreshedSession;
}

export async function persistAuthSession(session: AuthSession | null) {
  if (!session) {
    await clearAuthSession();
    return null;
  }
  await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearAuthSession() {
  return AsyncStorage.removeItem(AUTH_SESSION_KEY);
}
