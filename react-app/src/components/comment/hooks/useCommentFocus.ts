import { useEffect, useState } from "react";
import { Platform } from "react-native";
import type { CommentItem } from "../../../services/commentsApi";
import { findRootId } from "../utils";
import type { FlatCommentItem } from "./useCommentLoad";

type UseCommentFocusProps = {
  focusCommentId?: number;
  commentsById: Map<number, CommentItem>;
  flatComments: FlatCommentItem[];
  hasScrolledToFocus: boolean;
  keyboardInset: number;
  listRef: React.RefObject<any>;
  scrollItemAboveKeyboard: (
    itemId: number,
    options: { fallbackIndex: number },
  ) => void;
  setExpandedRoots: React.Dispatch<React.SetStateAction<Set<number>>>;
  setPendingReplyFocusId: React.Dispatch<React.SetStateAction<number | null>>;
};

export function useCommentFocus({
  focusCommentId,
  commentsById,
  flatComments,
  hasScrolledToFocus,
  keyboardInset,
  listRef,
  scrollItemAboveKeyboard,
  setExpandedRoots,
  setPendingReplyFocusId,
}: UseCommentFocusProps) {
  const [highlightedCommentId, setHighlightedCommentId] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (!focusCommentId || !commentsById.has(focusCommentId)) {
      return;
    }
    const focusComment = commentsById.get(focusCommentId)!;
    const rootId = findRootId(focusComment, commentsById);
    setExpandedRoots((current) => {
      if (current.has(rootId)) {
        return current;
      }
      const next = new Set(current);
      next.add(rootId);
      return next;
    });
  }, [commentsById, focusCommentId, setExpandedRoots]);

  useEffect(() => {
    if (!focusCommentId || hasScrolledToFocus || !flatComments.length) {
      return;
    }
    const targetIndex = flatComments.findIndex(
      (item) => item.comment.id === focusCommentId,
    );
    if (targetIndex < 0) {
      return;
    }
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({
        index: targetIndex,
        animated: true,
        viewPosition: 0.28,
      });
      setHighlightedCommentId(focusCommentId);
    }, 80);
    return () => clearTimeout(timer);
  }, [
    flatComments,
    focusCommentId,
    hasScrolledToFocus,
    listRef,
  ]);

  useEffect(() => {
    if (!highlightedCommentId) {
      return;
    }
    const timer = setTimeout(() => setHighlightedCommentId(null), 1800);
    return () => clearTimeout(timer);
  }, [highlightedCommentId]);

  return { highlightedCommentId, setHighlightedCommentId };
}
