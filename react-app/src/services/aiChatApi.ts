import { API_V1_BASE_URL } from "../config/api";
import i18n from "../i18n";

export type AiChatRole = "user" | "assistant" | "system";

export type AiChatRequestMessage = {
  role: AiChatRole;
  content: string;
};

type AiStreamEvent =
  | { type: "start" }
  | { type: "delta"; content?: string }
  | { type: "done" }
  | { type: "error"; message?: string };

type StreamAiChatOptions = {
  accessToken: string;
  messages: AiChatRequestMessage[];
  signal?: AbortSignal;
  onDelta: (content: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
};

function readXhrErrorMessage(responseText: string) {
  try {
    const data = JSON.parse(responseText) as { detail?: string | { msg?: string }[] };
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg;
  } catch {
    return i18n.t("请求失败，请稍后重试。");
  }
  return i18n.t("请求失败，请稍后重试。");
}

function parseSseBlock(block: string): AiStreamEvent | null {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  return JSON.parse(data) as AiStreamEvent;
}

function createAbortError() {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

export async function streamAiChat({
  accessToken,
  messages,
  signal,
  onDelta,
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
          settle(new Error(i18n.t("AI 回复解析失败，请稍后重试。")));
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
        settle(new Error(readXhrErrorMessage(xhr.responseText)));
        return;
      }
      processChunk();
      if (!settled) {
        onDone?.();
        settle();
      }
    };
    xhr.onerror = () => settle(new Error(i18n.t("网络连接失败，请稍后重试。")));
    xhr.onabort = () => settle(createAbortError());
    signal?.addEventListener("abort", abort);
    xhr.send(JSON.stringify({ messages }));
  });
}
