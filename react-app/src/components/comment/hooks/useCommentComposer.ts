import { useState } from "react";
import type { CommentItem } from "../../../services/commentsApi";
import { findRootId } from "../utils";

type UseCommentComposerProps = {
  commentsById: Map<number, CommentItem>;
  setExpandedRoots: React.Dispatch<React.SetStateAction<Set<number>>>;
  setPendingReplyFocusId: React.Dispatch<React.SetStateAction<number | null>>;
};

export function useCommentComposer({
  commentsById,
  setExpandedRoots,
  setPendingReplyFocusId,
}: UseCommentComposerProps) {
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<CommentItem | null>(null);

  const startReply = (comment: CommentItem) => {
    const rootId = findRootId(comment, commentsById);
    setReplyingTo(comment);
    setBody("");
    setExpandedRoots((current) => new Set(current).add(rootId));
    setPendingReplyFocusId(comment.id);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setBody("");
  };

  return {
    body,
    setBody,
    replyingTo,
    setReplyingTo,
    startReply,
    cancelReply,
  };
}
