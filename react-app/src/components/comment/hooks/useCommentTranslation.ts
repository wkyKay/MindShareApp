import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useApiErrorHandler } from "../../../hooks/useApiErrorHandler";
import type { AuthSession } from "../../../services/authSession";
import type { CommentItem } from "../../../services/commentsApi";
import { translateContent } from "../../../services/translationsApi";

type UseCommentTranslationProps = {
  currentSession: AuthSession | null | undefined;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
};

export function useCommentTranslation({
  currentSession,
  setMessage,
}: UseCommentTranslationProps) {
  const { i18n, t } = useTranslation();
  const handleApiError = useApiErrorHandler();
  const [translatedComments, setTranslatedComments] = useState<
    Record<number, string>
  >({});
  const [visibleTranslatedComments, setVisibleTranslatedComments] = useState<
    Set<number>
  >(new Set());
  const [translatingCommentId, setTranslatingCommentId] = useState<
    number | null
  >(null);

  const toggleCommentTranslation = async (comment: CommentItem) => {
    if (visibleTranslatedComments.has(comment.id)) {
      setVisibleTranslatedComments((current) => {
        const next = new Set(current);
        next.delete(comment.id);
        return next;
      });
      return;
    }
    if (translatedComments[comment.id]) {
      setVisibleTranslatedComments((current) =>
        new Set(current).add(comment.id),
      );
      return;
    }
    if (!currentSession) {
      return;
    }
    setTranslatingCommentId(comment.id);
    try {
      const result = await translateContent(
        {
          content_type: "comment",
          content_id: comment.id,
          field: "body",
          target_language: i18n.language,
        },
        currentSession.accessToken,
      );
      setTranslatedComments((current) => ({
        ...current,
        [comment.id]: result.translated_text,
      }));
      setVisibleTranslatedComments((current) =>
        new Set(current).add(comment.id),
      );
    } catch (error) {
      handleApiError(error, {
        fallback: t("翻译失败，请稍后重试。"),
        setMessage,
      });
    } finally {
      setTranslatingCommentId(null);
    }
  };

  return {
    translatedComments,
    visibleTranslatedComments,
    translatingCommentId,
    toggleCommentTranslation,
  };
}
