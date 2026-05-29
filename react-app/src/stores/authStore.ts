import { create } from 'zustand';

import { clearAuthSession, loadAuthSession, refreshAuthSession, saveAuthSession, type AuthSession } from '../services/authSession';
import type { TokenResponse } from '../services/authApi';

type AuthStore = {
  session: AuthSession | null;
  isLoading: boolean;
  hasHydrated: boolean;
  hydrate: () => Promise<AuthSession | null>;
  refresh: () => Promise<AuthSession | null>;
  setFromToken: (tokenResponse: TokenResponse) => Promise<AuthSession>;
  setSession: (session: AuthSession | null) => void;
  logout: () => Promise<void>;
  requireSession: () => Promise<AuthSession | null>;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  isLoading: false,
  hasHydrated: false,
  async hydrate() {
    set({ isLoading: true });
    try {
      const session = await loadAuthSession();
      set({ session, hasHydrated: true });
      return session;
    } finally {
      set({ isLoading: false });
    }
  },
  async refresh() {
    set({ isLoading: true });
    try {
      const session = await refreshAuthSession();
      set({ session, hasHydrated: true });
      return session;
    } catch {
      await clearAuthSession();
      set({ session: null, hasHydrated: true });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },
  async setFromToken(tokenResponse) {
    const session = await saveAuthSession(tokenResponse);
    set({ session, hasHydrated: true });
    return session;
  },
  setSession(session) {
    set({ session, hasHydrated: true });
  },
  async logout() {
    await clearAuthSession();
    set({ session: null, hasHydrated: true });
  },
  async requireSession() {
    const currentSession = get().session;
    if (currentSession) {
      return currentSession;
    }
    return get().hydrate();
  },
}));
