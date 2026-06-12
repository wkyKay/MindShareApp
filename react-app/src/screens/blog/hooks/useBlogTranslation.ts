import { useCallback, useState } from "react";
import type { TFunction } from "i18next";

import type { AuthSession } from "../../../services/authSession";
import type { PostDetail } from "../../../services/postApi";
import { translateContent } from "../../../services/translationsApi";

type UseBlogTranslationOptions = {
  language: string;
  requireSession: () => Promise<AuthSession | null>;
  setMessage: (message: string) => void;
  t: TFunction;
};

export function useBlogTranslation({
  language,
  requireSession,
  setMessage,
  t,
}: UseBlogTranslationOptions) {
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);
  const [isBodyTranslationVisible, setIsBodyTranslationVisible] =
    useState(false);
  const [isTranslatingBody, setIsTranslatingBody] = useState(false);

  const resetBodyTranslation = useCallback(() => {
    setTranslatedBody(null);
    setIsBodyTranslationVisible(false);
  }, []);

  const toggleBodyTranslation = useCallback(
    async (post: PostDetail | null) => {
      if (!post) {
        return;
      }
      if (isBodyTranslationVisible) {
        setIsBodyTranslationVisible(false);
        return;
      }
      if (translatedBody) {
        setIsBodyTranslationVisible(true);
        return;
      }
      const activeSession = await requireSession();
      if (!activeSession) {
        return;
      }
      setIsTranslatingBody(true);
      try {
        const result = await translateContent(
          {
            content_type: "post",
            content_id: post.id,
            field: "body",
            target_language: language,
          },
          activeSession.accessToken,
        );
        setTranslatedBody(result.translated_text);
        setIsBodyTranslationVisible(true);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : t("翻译失败，请稍后重试。"),
        );
      } finally {
        setIsTranslatingBody(false);
      }
    },
    [
      isBodyTranslationVisible,
      language,
      requireSession,
      setMessage,
      t,
      translatedBody,
    ],
  );

  return {
    isBodyTranslationVisible,
    isTranslatingBody,
    resetBodyTranslation,
    toggleBodyTranslation,
    translatedBody,
  };
}
