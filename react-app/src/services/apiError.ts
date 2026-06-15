import i18n from "../i18n";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "REQUEST_ERROR";

type ApiErrorOptions = {
  status: number;
  message: string;
  code?: string;
  detail?: unknown;
};

export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: unknown;

  constructor({ status, message, code, detail }: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    return await fetch(input, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    throw createNetworkApiError(error);
  }
}

export async function throwApiError(response: Response): Promise<never> {
  throw await createApiErrorFromResponse(response);
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function isAuthExpiredError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

export function createNetworkApiError(detail?: unknown) {
  return new ApiError({
    status: 0,
    code: "NETWORK_ERROR",
    message: i18n.t("网络连接失败，请检查网络后重试。"),
    detail,
  });
}

export function createApiErrorFromBody(
  status: number,
  body: unknown,
  fallbackMessage?: string,
) {
  const code = extractErrorCode(status, body);
  return new ApiError({
    status,
    code,
    message:
      extractErrorMessage(status, body) || fallbackMessage || defaultMessage(status),
    detail: extractErrorDetail(body),
  });
}

async function createApiErrorFromResponse(response: Response) {
  let body: unknown;
  try {
    const contentType = response.headers.get("content-type") || "";
    body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
  } catch {
    body = undefined;
  }
  return createApiErrorFromBody(response.status, body);
}

function extractErrorCode(status: number, body: unknown): ApiErrorCode | string {
  if (isRecord(body) && typeof body.code === "string") {
    return body.code;
  }
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 422) return "VALIDATION_ERROR";
  if (status >= 500) return "SERVER_ERROR";
  return "REQUEST_ERROR";
}

function extractErrorMessage(status: number, body: unknown) {
  if (shouldUseDefaultMessage(status)) return undefined;
  if (!isRecord(body)) return undefined;
  const detail = body.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const firstMessage = detail.find(
      (item): item is { msg: string } =>
        isRecord(item) && typeof item.msg === "string",
    );
    return firstMessage?.msg;
  }
  if (typeof body.message === "string") return body.message;
  if (typeof body.error === "string") return body.error;
  return undefined;
}

function extractErrorDetail(body: unknown) {
  if (!isRecord(body)) return body;
  return body.detail ?? body;
}

function defaultMessage(status: number) {
  if (status === 401) return i18n.t("登录已失效，请重新登录。");
  if (status === 403) return i18n.t("无权限执行该操作。");
  if (status === 404) return i18n.t("资源不存在或已被删除。");
  if (status === 422) return i18n.t("提交内容校验失败，请检查后重试。");
  if (status >= 500) return i18n.t("服务端异常，请稍后重试。");
  return i18n.t("请求失败，请稍后重试。");
}

function shouldUseDefaultMessage(status: number) {
  return status === 401 || status === 403 || status === 404 || status >= 500;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
