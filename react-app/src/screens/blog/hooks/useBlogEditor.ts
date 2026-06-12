import type { Dispatch, SetStateAction } from "react";
import { useCallback, useState } from "react";

import { updatePost, type PostDetail } from "../../../services/postApi";
import type { AuthSession } from "../../../services/authSession";

type UseBlogEditorOptions = {
  currentSession: AuthSession | null;
  setMessage: (message: string) => void;
  setPost: Dispatch<SetStateAction<PostDetail | null>>;
};

export function useBlogEditor({
  currentSession,
  setMessage,
  setPost,
}: UseBlogEditorOptions) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const resetEditor = useCallback((post: PostDetail, shouldEdit: boolean) => {
    setTitle(post.title);
    setBody(post.body);
    setIsEditing(shouldEdit);
  }, []);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const saveEdit = useCallback(
    async (post: PostDetail | null) => {
      if (!post || !currentSession) {
        return;
      }
      if (!title.trim() || !body.trim()) {
        setMessage("标题和正文不能为空。");
        return;
      }

      const nextTitle = title.trim();
      const nextBody = body.trim();
      const nextSummary = nextBody.slice(0, 120);

      try {
        await updatePost(
          post.id,
          {
            title: nextTitle,
            body: nextBody,
            summary: nextSummary,
          },
          currentSession.accessToken,
        );
        setPost({
          ...post,
          title: nextTitle,
          body: nextBody,
          summary: nextSummary,
        });
        setIsEditing(false);
        setMessage("已保存修改。");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败。");
      }
    },
    [body, currentSession, setMessage, setPost, title],
  );

  return {
    body,
    isEditing,
    title,
    cancelEdit,
    resetEditor,
    saveEdit,
    setBody,
    setTitle,
  };
}
