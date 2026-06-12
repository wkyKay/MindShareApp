import { API_V1_BASE_URL } from "../config/api";
import { apiFetch, throwApiError } from "./apiError";

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
  const response = await apiFetch(`${API_V1_BASE_URL}/translations/content`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source_language: "auto", ...payload }),
  });
  if (!response.ok) {
    await throwApiError(response);
  }
  return (await response.json()) as TranslationContentResponse;
}
