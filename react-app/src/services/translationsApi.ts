import { API_V1_BASE_URL } from "../config/api";
import i18n from "../i18n";

export type TranslationContentType =
  | "post"
  | "comment"
  | "message"
  | "collection";

export type TranslationContentField =
  | "title"
  | "body"
  | "summary"
  | "description";

export type TranslationContentResponse = {
  content_type: TranslationContentType;
  content_id: number;
  field: TranslationContentField;
  source_language: string;
  target_language: string;
  translated_text: string;
  provider: string;
  cached: boolean;
};

async function readErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as {
      detail?: string | { msg?: string }[];
    };
    if (typeof data.detail === "string") {
      return data.detail;
    }
    if (Array.isArray(data.detail) && data.detail[0]?.msg) {
      return data.detail[0].msg;
    }
  } catch {
    return i18n.t("请求失败，请稍后重试。");
  }
  return i18n.t("请求失败，请稍后重试。");
}

export async function translateContent(
  payload: {
    content_type: TranslationContentType;
    content_id: number;
    field: TranslationContentField;
    target_language: string;
    source_language?: string;
  },
  accessToken: string,
) {
  const response = await fetch(`${API_V1_BASE_URL}/translations/content`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source_language: "auto", ...payload }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as TranslationContentResponse;
}
