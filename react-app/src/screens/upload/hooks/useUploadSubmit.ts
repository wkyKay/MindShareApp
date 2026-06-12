import { useState } from "react";

import type { AuthSession } from "../../../services/authSession";
import { createPost, type CreatePostPayload } from "../../../services/postApi";

type UploadAsset = { id: number };

type UseUploadSubmitOptions = {
  currentSession: AuthSession | null;
  requireAuthSession: () => Promise<AuthSession | null>;
  title: string;
  body: string;
  images: UploadAsset[];
  documents: UploadAsset[];
  tags: string[];
  setMessage: (message: string) => void;
  onSaved: () => void;
};

export function useUploadSubmit({
  currentSession,
  requireAuthSession,
  title,
  body,
  images,
  documents,
  tags,
  setMessage,
  onSaved,
}: UseUploadSubmitOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitPost(status: CreatePostPayload["status"]) {
    setMessage("");

    const activeSession = currentSession ?? (await requireAuthSession());
    if (!activeSession) {
      setMessage("请先登录后再发布。");
      return;
    }
    if (!title.trim() || !body.trim()) {
      setMessage("请填写标题和正文。");
      return;
    }

    setIsSubmitting(true);
    try {
      await createPost(
        {
          title: title.trim(),
          body: body.trim(),
          summary: body.trim().slice(0, 120),
          image_asset_ids: images.map((item) => item.id),
          document_asset_ids: documents.map((item) => item.id),
          tags,
          visibility: status === "draft" ? "private" : "public",
          status,
        },
        activeSession.accessToken,
      );
      onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "上传失败，请稍后重试。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    isSubmitting,
    submitPost,
  };
}
