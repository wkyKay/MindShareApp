import { useState } from "react";
import { ScrollView, Text } from "react-native";

import type { AuthSession } from "../services/authSession";
import { useAuthStore } from "../stores/authStore";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../theme/ThemeProvider";
import { DocumentUploadPanel } from "./upload/DocumentUploadPanel";
import { ImageUploadPanel } from "./upload/ImageUploadPanel";
import { MarkdownPreviewPanel } from "./upload/MarkdownPreviewPanel";
import { PublishActions } from "./upload/PublishActions";
import { TagEditor } from "./upload/TagEditor";
import { useUploadAssets } from "./upload/hooks/useUploadAssets";
import { useUploadSubmit } from "./upload/hooks/useUploadSubmit";
import { useUploadTags } from "./upload/hooks/useUploadTags";
import { UploadEditorFields } from "./upload/UploadEditorFields";
import { UploadHeader } from "./upload/UploadHeader";

type UploadScreenProps = {
  session: AuthSession | null;
  onCancel: () => void;
  onSaved: () => void;
};

function splitPreviewBody(body: string) {
  const lastNewlineIndex = body.lastIndexOf("\n");
  if (lastNewlineIndex === -1) {
    return { renderedMarkdown: "", rawDraft: body };
  }

  return {
    renderedMarkdown: body.slice(0, lastNewlineIndex + 1),
    rawDraft: body.slice(lastNewlineIndex + 1),
  };
}

export function UploadScreen({
  session,
  onCancel,
  onSaved,
}: UploadScreenProps) {
  const { resolvedMode, styles } = useAppTheme();
  const storeSession = useAuthStore((state) => state.session);
  const requireAuthSession = useAuthStore((state) => state.requireSession);
  const currentSession = storeSession ?? session;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const previewBody = splitPreviewBody(body);
  const { t } = useTranslation();
  const uploadTags = useUploadTags();
  const uploadAssets = useUploadAssets({
    currentSession,
    requireAuthSession,
    setBody,
    setMessage,
    t,
  });
  const uploadSubmit = useUploadSubmit({
    currentSession,
    requireAuthSession,
    title,
    body,
    images: uploadAssets.images,
    documents: uploadAssets.documents,
    tags: uploadTags.tags,
    setMessage,
    onSaved,
  });

  return (
    <ScrollView
      style={styles.homeScreen}
      contentContainerStyle={styles.pageContent}
      indicatorStyle={resolvedMode === "dark" ? "white" : "black"}
      showsVerticalScrollIndicator={false}
    >
      <UploadHeader onCancel={onCancel} styles={styles} t={t} />

      <UploadEditorFields
        title={title}
        body={body}
        onChangeTitle={setTitle}
        onChangeBody={setBody}
        styles={styles}
        t={t}
      />

      <MarkdownPreviewPanel
        renderedMarkdown={previewBody.renderedMarkdown}
        rawDraft={previewBody.rawDraft}
        styles={styles}
        t={t}
      />

      <ImageUploadPanel
        images={uploadAssets.images}
        onPickImage={() => void uploadAssets.pickImage()}
        styles={styles}
        t={t}
      />

      <DocumentUploadPanel
        documents={uploadAssets.documents}
        onPickDocument={() => void uploadAssets.pickDocument()}
        onParseTextDocument={() => void uploadAssets.parseTextDocument()}
        styles={styles}
        t={t}
      />

      <TagEditor
        tagInput={uploadTags.tagInput}
        tags={uploadTags.tags}
        onChangeTagInput={uploadTags.setTagInput}
        onAddTag={uploadTags.addTag}
        onRemoveTag={uploadTags.removeTag}
        styles={styles}
        t={t}
      />

      <PublishActions
        isSubmitting={uploadSubmit.isSubmitting}
        onSubmit={(status) => void uploadSubmit.submitPost(status)}
        styles={styles}
        t={t}
      />
      {!!message && (
        <Text style={[styles.authApiHint, { color: "#a05d6f" }]}>
          {message}
        </Text>
      )}
    </ScrollView>
  );
}
