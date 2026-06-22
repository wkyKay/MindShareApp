import { useCallback } from "react";

import { getApiErrorMessage, isAuthExpiredError } from "../services/apiError";
import { useAuthStore } from "../stores/authStore";

type ApiErrorHandlerOptions = {
  fallback: string;
  ignoreAbort?: boolean;
  setMessage?: (message: string) => void;
};

export function useApiErrorHandler() {
  const logout = useAuthStore((state) => state.logout);

  return useCallback(function handleApiError(
    error: unknown,
    options: string | ApiErrorHandlerOptions,
  ) {
    const config =
      typeof options === "string" ? { fallback: options } : options;
    if (
      config.ignoreAbort &&
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      return "";
    }
    if (isAuthExpiredError(error)) {
      void logout();
    }
    const message = getApiErrorMessage(error, config.fallback);
    config.setMessage?.(message);
    return message;
  }, [logout]);
}
