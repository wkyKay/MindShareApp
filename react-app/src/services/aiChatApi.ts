import { API_V1_BASE_URL } from "../config/api";
import i18n from "../i18n";
import type { PartialThemeColors } from "../theme/ThemeProvider";
import { createApiErrorFromBody, createNetworkApiError } from "./apiError";
import { refreshAuthTokens } from "./apiClient";

export type AiChatRole = "user" | "assistant" | "system";

export type AiChatRequestMessage = {
  role: AiChatRole;
  content: string;
};

export type ReferenceItem = {
  post_id: number;
  post_title: string;
  chunk_index?: number;
  content?: string;
};

type AiStreamEvent =
  | { type: "start" }
  | { type: "delta"; content?: string }
  | {
      type: "theme_proposal";
      theme: PartialThemeColors;
      description: string;
    }
  | {
      type: "tool_status";
      tool?: string;
      status?: "running" | "done";
      display?: string;
    }
  | { type: "cached"; from_cache?: boolean }
  | { type: "references"; references?: ReferenceItem[] }
  | { type: "done" }
  | { type: "error"; message?: string };

type StreamAiChatOptions = {
  accessToken: string;
  messages: AiChatRequestMessage[];
  /** 当前激活的主题模式，用于 Agent 生成主题时参考 */
  currentMode?: "light" | "dark";
  signal?: AbortSignal;
  onDelta: (content: string) => void;
  onThemeProposal?: (theme: PartialThemeColors, description: string) => void;
  onToolStatus?: (tool: string, status: "running" | "done", display?: string) => void;
  onReferences?: (references: ReferenceItem[]) => void;
  onCached?: () => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

function createXhrApiError(status: number, responseText: string) {
  try {
    return createApiErrorFromBody(status, JSON.parse(responseText));
  } catch {
    return createApiErrorFromBody(status, undefined);
  }
}

function parseSseBlock<T = AiStreamEvent>(block: string): T | null {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  return JSON.parse(data) as T;
}

function createAbortError() {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

export async function streamAiChat({
  accessToken,
  messages,
  currentMode = "light",
  signal,
  onDelta,
  onThemeProposal,
  onToolStatus,
  onReferences,
  onCached,
  onDone,
  onError,
}: StreamAiChatOptions) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let activeXhr: XMLHttpRequest | null = null;

    function settle(error?: Error) {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    }

    function abort() {
      activeXhr?.abort();
      settle(createAbortError());
    }

    function handleEvent(event: AiStreamEvent | null) {
      if (!event || event.type === "start") return;
      if (event.type === "delta") {
        onDelta(event.content || "");
        return;
      }
      if (event.type === "theme_proposal") {
        onThemeProposal?.(event.theme, event.description);
        return;
      }
      if (event.type === "tool_status") {
        onToolStatus?.(event.tool || "", event.status || "running", event.display);
        return;
      }
      if (event.type === "cached") {
        onCached?.();
        return;
      }
      if (event.type === "references") {
        onReferences?.(event.references || []);
        return;
      }
      if (event.type === "error") {
        const message = event.message || i18n.t("AI 回复失败，请稍后重试。");
        onError?.(message);
        settle(new Error(message));
        return;
      }
      if (event.type === "done") {
        onDone?.();
        settle();
      }
    }

    function runRequest(token: string, retried: boolean) {
      if (settled) return;

      const xhr = new XMLHttpRequest();
      activeXhr = xhr;
      let buffer = "";
      let processedLength = 0;

      function processChunk() {
        if (xhr.status >= 400) return;
        const chunk = xhr.responseText.slice(processedLength);
        processedLength = xhr.responseText.length;
        buffer += chunk;

        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          try {
            handleEvent(parseSseBlock(block));
          } catch {
            // 忽略解析失败的事件（向前兼容：未知事件类型）
          }
        }
      }

      xhr.open("POST", `${API_V1_BASE_URL}/ai/chat/stream`);
      xhr.setRequestHeader("Accept", "text/event-stream");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.onprogress = processChunk;
      xhr.onload = async () => {
        // 401：静默刷新 access token 后重试一次，避免向 UI 抛错
        if (xhr.status === 401 && !retried) {
          const newSession = await refreshAuthTokens();
          if (settled) return;
          if (newSession) {
            runRequest(newSession.accessToken, true);
            return;
          }
          settle(createXhrApiError(xhr.status, xhr.responseText));
          return;
        }
        if (xhr.status >= 400) {
          settle(createXhrApiError(xhr.status, xhr.responseText));
          return;
        }
        processChunk();
        if (!settled) {
          onDone?.();
          settle();
        }
      };
      xhr.onerror = () => settle(createNetworkApiError());
      xhr.onabort = () => settle(createAbortError());
      signal?.addEventListener("abort", abort);
      xhr.send(JSON.stringify({ messages, current_mode: currentMode }));
    }

    if (signal?.aborted) {
      settle(createAbortError());
      return;
    }

    runRequest(accessToken, false);
  });
}

export type BlogAiChatMode = "read" | "edit";

export type PostEditProposal = {
  title: string;
  summary?: string | null;
  body: string;
  description: string;
};

type BlogStreamEvent =
  | { type: "start" }
  | { type: "delta"; content?: string }
  | {
      type: "post_edit_proposal";
      title: string;
      summary?: string | null;
      body: string;
      description: string;
    }
  | {
      type: "tool_status";
      tool?: string;
      status?: "running" | "done";
      display?: string;
    }
  | { type: "references"; references?: ReferenceItem[] }
  | { type: "done" }
  | { type: "error"; message?: string };

type StreamBlogAiChatOptions = {
  accessToken: string;
  postId: number;
  mode: BlogAiChatMode;
  messages: AiChatRequestMessage[];
  signal?: AbortSignal;
  onDelta: (content: string) => void;
  onPostEditProposal?: (proposal: PostEditProposal) => void;
  onToolStatus?: (tool: string, status: "running" | "done", display?: string) => void;
  onReferences?: (references: ReferenceItem[]) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

export async function streamBlogAiChat({
  accessToken,
  postId,
  mode,
  messages,
  signal,
  onDelta,
  onPostEditProposal,
  onToolStatus,
  onReferences,
  onDone,
  onError,
}: StreamBlogAiChatOptions) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let activeXhr: XMLHttpRequest | null = null;

    function settle(error?: Error) {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    }

    function abort() {
      activeXhr?.abort();
      settle(createAbortError());
    }

    function handleEvent(event: BlogStreamEvent | null) {
      if (!event || event.type === "start") return;
      if (event.type === "delta") {
        onDelta(event.content || "");
        return;
      }
      if (event.type === "post_edit_proposal") {
        onPostEditProposal?.({
          title: event.title,
          summary: event.summary,
          body: event.body,
          description: event.description,
        });
        return;
      }
      if (event.type === "tool_status") {
        onToolStatus?.(event.tool || "", event.status || "running", event.display);
        return;
      }
      if (event.type === "references") {
        onReferences?.(event.references || []);
        return;
      }
      if (event.type === "error") {
        const message = event.message || i18n.t("AI 回复失败，请稍后重试。");
        onError?.(message);
        settle(new Error(message));
        return;
      }
      if (event.type === "done") {
        onDone?.();
        settle();
      }
    }

    function runRequest(token: string, retried: boolean) {
      if (settled) return;

      const xhr = new XMLHttpRequest();
      activeXhr = xhr;
      let buffer = "";
      let processedLength = 0;

      function processChunk() {
        if (xhr.status >= 400) return;
        const chunk = xhr.responseText.slice(processedLength);
        processedLength = xhr.responseText.length;
        buffer += chunk;

        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          try {
            handleEvent(parseSseBlock<BlogStreamEvent>(block));
          } catch {
            // 忽略解析失败的事件（向前兼容：未知事件类型）
          }
        }
      }

      xhr.open("POST", `${API_V1_BASE_URL}/ai/blog/stream`);
      xhr.setRequestHeader("Accept", "text/event-stream");
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.onprogress = processChunk;
      xhr.onload = async () => {
        // 401：静默刷新 access token 后重试一次，避免向 UI 抛错
        if (xhr.status === 401 && !retried) {
          const newSession = await refreshAuthTokens();
          if (settled) return;
          if (newSession) {
            runRequest(newSession.accessToken, true);
            return;
          }
          settle(createXhrApiError(xhr.status, xhr.responseText));
          return;
        }
        if (xhr.status >= 400) {
          settle(createXhrApiError(xhr.status, xhr.responseText));
          return;
        }
        processChunk();
        if (!settled) {
          onDone?.();
          settle();
        }
      };
      xhr.onerror = () => settle(createNetworkApiError());
      xhr.onabort = () => settle(createAbortError());
      signal?.addEventListener("abort", abort);
      xhr.send(JSON.stringify({ post_id: postId, mode, messages }));
    }

    if (signal?.aborted) {
      settle(createAbortError());
      return;
    }

    runRequest(accessToken, false);
  });
}
