import { useEffect, useMemo, useState } from "react";
import type { AuthSession } from "../../../services/authSession";
import { getComments, type CommentItem } from "../../../services/commentsApi";
import { findRootId } from "../utils";

export type FlatCommentItem = {
  id: string;
  type: "root" | "reply";
  comment: CommentItem;
  rootId: number;
  replyCount: number;
};

type UseCommentLoadProps = {
  postId: number;
  currentSession: AuthSession | null | undefined;
  onCommentCountChange: (count: number) => void;
  expandedRoots: Set<number>;
};

export function useCommentLoad({
  postId,
  currentSession,
  onCommentCountChange,
  expandedRoots,
}: UseCommentLoadProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [hasScrolledToFocus, setHasScrolledToFocus] = useState(false);

  const commentsById = useMemo(
    () => new Map(comments.map((comment) => [comment.id, comment])),
    [comments],
  );

  const { roots, repliesByRoot } = useMemo(() => {
    const replyMap = new Map<number, CommentItem[]>();
    const rootItems: CommentItem[] = [];

    for (const comment of comments) {
      if (comment.parent_id) {
        const rootId = findRootId(comment, commentsById);
        replyMap.set(rootId, [...(replyMap.get(rootId) || []), comment]);
      } else {
        rootItems.push(comment);
      }
    }

    return { roots: rootItems, repliesByRoot: replyMap };
  }, [comments, commentsById]);

  const flatComments = useMemo(() => {
    const items: FlatCommentItem[] = [];
    for (const root of roots) {
      const replies = repliesByRoot.get(root.id) || [];
      items.push({
        id: `root-${root.id}`,
        type: "root",
        comment: root,
        rootId: root.id,
        replyCount: replies.length,
      });
      if (expandedRoots.has(root.id)) {
        for (const reply of replies) {
          items.push({
            id: `reply-${reply.id}`,
            type: "reply",
            comment: reply,
            rootId: root.id,
            replyCount: 0,
          });
        }
      }
    }
    return items;
  }, [expandedRoots, repliesByRoot, roots]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const accessToken = currentSession?.accessToken;

    async function loadComments() {
      setIsLoading(true);
      setMessage("");
      setHasScrolledToFocus(false);
      try {
        const data = await getComments(postId, accessToken, controller.signal);
        if (isMounted) {
          setComments(data.items);
          onCommentCountChange(data.total);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : "评论加载失败。");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadComments();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [
    currentSession?.accessToken,
    onCommentCountChange,
    postId,
  ]);

  return {
    comments,
    commentsById,
    flatComments,
    isLoading,
    message,
    hasScrolledToFocus,
    setComments,
    setMessage,
    setHasScrolledToFocus,
  };
}
