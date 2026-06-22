import { useCallback } from "react";
import type { AuthSession } from "../../../services/authSession";
import {
  createComment,
  deleteComment,
  setCommentLiked,
  type CommentItem,
} from "../../../services/commentsApi";
import { findRootId, collectDeletedIds } from "../utils";

type UseCommentActionsProps = {
  postId: number;
  currentSession: AuthSession | null | undefined;
  comments: CommentItem[];
  commentsById: Map<number, CommentItem>;
  requireAuthSession: () => Promise<AuthSession | null>;
  onRequireAuth: () => void;
  onCommentCountChange: (count: number) => void;
  setComments: React.Dispatch<React.SetStateAction<CommentItem[]>>;
  setExpandedRoots: React.Dispatch<React.SetStateAction<Set<number>>>;
  setReplyingTo: React.Dispatch<React.SetStateAction<CommentItem | null>>;
  setBody: React.Dispatch<React.SetStateAction<string>>;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
};

export function useCommentActions({
  postId,
  currentSession,
  comments,
  commentsById,
  requireAuthSession,
  onRequireAuth,
  onCommentCountChange,
  setComments,
  setExpandedRoots,
  setReplyingTo,
  setBody,
  setMessage,
}: UseCommentActionsProps) {
  const requireSession = useCallback(async () => {
    const activeSession = await requireAuthSession();
    if (!activeSession) {
      onRequireAuth();
      return null;
    }
    return activeSession;
  }, [requireAuthSession, onRequireAuth]);

  const submitComment = useCallback(
    async (
      replyingTo: CommentItem | null,
      body: string,
    ) => {
      const text = body.trim();
      if (!text) {
        setMessage("评论不能为空。");
        return;
      }
      const activeSession = await requireSession();
      if (!activeSession) return;
      const optimisticComment: CommentItem = {
        id: -Date.now(),
        body: text,
        author: {
          id: activeSession.user.id,
          display_name: activeSession.user.display_name,
          avatar_url: activeSession.user.avatar_url,
        },
        parent_id: replyingTo?.id ?? null,
        created_at: new Date().toISOString(),
        like_count: 0,
        is_liked: false,
      };
      setMessage("");
      setComments((current) => [...current, optimisticComment]);
      onCommentCountChange(comments.length + 1);
      if (replyingTo) {
        const rootId = findRootId(replyingTo, commentsById);
        setExpandedRoots((current) => new Set(current).add(rootId));
        setReplyingTo(null);
      }
      setBody("");
      try {
        const created = await createComment(
          postId,
          text,
          activeSession.accessToken,
          replyingTo?.id,
        );
        setComments((current) =>
          current.map((item) =>
            item.id === optimisticComment.id ? created : item,
          ),
        );
      } catch (error) {
        setComments((current) =>
          current.filter((item) => item.id !== optimisticComment.id),
        );
        onCommentCountChange(Math.max(0, comments.length));
        setBody(text);
        setReplyingTo(replyingTo ?? null);
        setMessage(error instanceof Error ? error.message : "评论发布失败。");
      }
    },
    [
      postId,
      requireSession,
      comments,
      commentsById,
      setComments,
      setExpandedRoots,
      setReplyingTo,
      setBody,
      setMessage,
      onCommentCountChange,
    ],
  );

  const toggleLike = useCallback(
    async (comment: CommentItem) => {
      const activeSession = await requireSession();
      if (!activeSession) return;
      const nextLiked = !comment.is_liked;
      const nextLikeCount = Math.max(
        0,
        comment.like_count + (nextLiked ? 1 : -1),
      );
      setComments((current) =>
        current.map((item) =>
          item.id === comment.id
            ? { ...item, is_liked: nextLiked, like_count: nextLikeCount }
            : item,
        ),
      );
      try {
        const data = await setCommentLiked(
          comment.id,
          nextLiked,
          activeSession.accessToken,
        );
        setComments((current) =>
          current.map((item) =>
            item.id === comment.id
              ? { ...item, is_liked: data.liked, like_count: data.like_count }
              : item,
          ),
        );
      } catch (error) {
        setComments((current) =>
          current.map((item) => (item.id === comment.id ? comment : item)),
        );
        setMessage(error instanceof Error ? error.message : "评论点赞失败。");
      }
    },
    [requireSession, setComments, setMessage],
  );

  const removeComment = useCallback(
    async (comment: CommentItem) => {
      const activeSession = await requireSession();
      if (!activeSession) return;
      const previousComments = comments;
      const deletedIds = comment.parent_id
        ? new Set<number>([comment.id])
        : collectDeletedIds(comment.id, comments);
      setComments((current) =>
        current
          .map((item) =>
            comment.parent_id && item.parent_id === comment.id
              ? { ...item, parent_id: comment.parent_id }
              : item,
          )
          .filter((item) => !deletedIds.has(item.id)),
      );
      onCommentCountChange(Math.max(0, comments.length - deletedIds.size));
      try {
        await deleteComment(comment.id, activeSession.accessToken);
      } catch (error) {
        setComments(previousComments);
        onCommentCountChange(previousComments.length);
        setMessage(error instanceof Error ? error.message : "评论删除失败。");
      }
    },
    [
      requireSession,
      comments,
      setComments,
      setMessage,
      onCommentCountChange,
    ],
  );

  const canDelete = useCallback(
    (comment: CommentItem) =>
      currentSession?.user.id === comment.author?.id,
    [currentSession],
  );

  const toggleRoot = useCallback(
    (rootId: number) => {
      setExpandedRoots((current) => {
        const next = new Set(current);
        if (next.has(rootId)) {
          next.delete(rootId);
        } else {
          next.add(rootId);
        }
        return next;
      });
    },
    [setExpandedRoots],
  );

  return {
    submitComment,
    toggleLike,
    removeComment,
    canDelete,
    toggleRoot,
  };
}
