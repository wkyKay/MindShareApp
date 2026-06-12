import { getApiErrorMessage, isAuthExpiredError } from "../services/apiError";
import { useAuthStore } from "../stores/authStore";

export function useApiErrorHandler() {
  const logout = useAuthStore((state) => state.logout);

  return function handleApiError(error: unknown, fallback: string) {
    if (isAuthExpiredError(error)) {
      void logout();
    }
    return getApiErrorMessage(error, fallback);
  };
}
