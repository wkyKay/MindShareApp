import { API_V1_BASE_URL } from "../config/api";
import i18n from "../i18n";
import type { PartialThemeColors } from "../theme/ThemeProvider";
import { createApiErrorFromBody, createNetworkApiError } from "./apiError";

export type AiChatRole = "user" | "assistant" | "system";

export type AiChatRequestMessage = {
  role: AiChatRole;
  content: string;
};

type AiStreamEvent =
  | { type: "start" }
  | { type: "delta"; content?: string }
  | {
      type: "theme_proposal";
      theme: PartialThemeColors;
      description: string;
    }
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
  onDone,
  onError,
}: StreamAiChatOptions) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let buffer = "";
    let processedLength = 0;
    let settled = false;

    function settle(error?: Error) {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
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

    function abort() {
      xhr.abort();
      settle(createAbortError());
    }

    if (signal?.aborted) {
      settle(createAbortError());
      return;
    }

    xhr.open("POST", `${API_V1_BASE_URL}/ai/chat/stream`);
    xhr.setRequestHeader("Accept", "text/event-stream");
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onprogress = processChunk;
    xhr.onload = () => {
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
  onDone,
  onError,
}: StreamBlogAiChatOptions) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let buffer = "";
    let processedLength = 0;
    let settled = false;

    function settle(error?: Error) {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
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

    function abort() {
      xhr.abort();
      settle(createAbortError());
    }

    if (signal?.aborted) {
      settle(createAbortError());
      return;
    }

    xhr.open("POST", `${API_V1_BASE_URL}/ai/blog/stream`);
    xhr.setRequestHeader("Accept", "text/event-stream");
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onprogress = processChunk;
    xhr.onload = () => {
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
  });
}
