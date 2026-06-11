import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import {
  createPost,
  parsePostDocument,
  uploadPostDocument,
  uploadPostImage,
  type CreatePostPayload,
} from "../services/postApi";
import type { AuthSession } from "../services/authSession";
import { useAuthStore } from "../stores/authStore";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../theme/ThemeProvider";
import { DocumentUploadPanel } from "./upload/DocumentUploadPanel";
import { ImageUploadPanel } from "./upload/ImageUploadPanel";
import { MarkdownPreviewPanel } from "./upload/MarkdownPreviewPanel";
import { PublishActions } from "./upload/PublishActions";
import { TagEditor } from "./upload/TagEditor";

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
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<{ id: number; url: string }[]>([]);
  const [documents, setDocuments] = useState<
    { id: number; name: string; url: string }[]
  >([]);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewBody = splitPreviewBody(body);
  const { t } = useTranslation();

  function addTag() {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) {
      setTagInput("");
      return;
    }
    setTags((currentTags) => [...currentTags, tag]);
    setTagInput("");
  }

  async function pickImage() {
    setMessage("");
    const activeSession = currentSession ?? (await requireAuthSession());
    if (!activeSession) {
      setMessage("请先登录后再上传图片。");
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage("需要相册权限才能插入图片。");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets.length) {
      return;
    }
    try {
      const asset = result.assets[0];
      const uploaded = await uploadPostImage(
        asset.uri,
        asset.fileName || `post-${Date.now()}.jpg`,
        activeSession.accessToken,
      );
      const uploadedUrl = uploaded.url;
      if (!uploadedUrl) {
        throw new Error("图片上传成功，但未返回可访问地址。");
      }
      setImages((current) => [
        ...current,
        { id: uploaded.id, url: uploadedUrl },
      ]);
      const imageMarkdown = t("![{{alt}}]({{url}})", {
        alt: t("图片"),
        url: uploadedUrl,
      });
      setBody(
        (current) =>
          `${current}${current.trim() ? "\n\n" : ""}${imageMarkdown}\n`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片上传失败。");
    }
  }

  async function pickDocument() {
    setMessage("");
    const activeSession = currentSession ?? (await requireAuthSession());
    if (!activeSession) {
      setMessage("请先登录后再上传文件。");
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/markdown",
        "text/x-markdown",
        "text/plain",
      ],
    });
    if (result.canceled || !result.assets.length) {
      return;
    }

    try {
      const asset = result.assets[0];
      const uploaded = await uploadPostDocument(
        asset.uri,
        asset.name || `document-${Date.now()}`,
        activeSession.accessToken,
        asset.mimeType,
      );
      const uploadedUrl = uploaded.url;
      if (!uploadedUrl) {
        throw new Error("文件上传成功，但未返回可访问地址。");
      }
      const documentName =
        uploaded.original_name || asset.name || t("附件：").replace("：", "");
      setDocuments((current) => [
        ...current,
        { id: uploaded.id, name: documentName, url: uploadedUrl },
      ]);
      setBody(
        (current) =>
          `${t("{{prefix}}[附件：{{name}}]({{url}})", {
            prefix: current.trim() ? `${current}\n\n` : current,
            name: documentName,
            url: uploadedUrl,
          })}\n`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "文件上传失败。");
    }
  }

  async function parseTextDocument() {
    setMessage("");
    const activeSession = currentSession ?? (await requireAuthSession());
    if (!activeSession) {
      setMessage("请先登录后再解析文件。");
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: "*/*",
    });
    if (result.canceled || !result.assets.length) {
      return;
    }

    try {
      const asset = result.assets[0];
      const lowerName = asset.name.toLowerCase();
      if (!lowerName.endsWith(".md") && !lowerName.endsWith(".docx")) {
        setMessage("请选择 .md Markdown 或 .docx Word 文件。");
        return;
      }
      const parsed = await parsePostDocument(
        asset.uri,
        asset.name || `markdown-${Date.now()}.md`,
        activeSession.accessToken,
        asset.mimeType,
      );
      if (!parsed.extracted_text?.trim()) {
        setMessage("Markdown 文件没有解析出正文内容。");
        return;
      }
      const importedMarkdown = t("## 来自文件：{{name}}\n\n{{content}}\n", {
        name: parsed.original_name,
        content: parsed.extracted_text.trim(),
      });
      setBody(
        (current) =>
          `${current}${current.trim() ? "\n\n" : ""}${importedMarkdown}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "文件解析失败。");
    }
  }

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

  return (
    <ScrollView
      style={styles.homeScreen}
      contentContainerStyle={styles.pageContent}
      indicatorStyle={resolvedMode === "dark" ? "white" : "black"}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeaderRow}>
        <Pressable style={styles.backButtonCompact} onPress={onCancel}>
          <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
        </Pressable>
        <Text style={styles.pageTitle}>{t("发布博客")}</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder={t("标题")}
        placeholderTextColor="#9a8f8a"
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        multiline
        style={[styles.input, styles.bodyInput, styles.longBodyInput]}
        placeholder={t(
          "写下正文，支持 Markdown，例如 # 标题、**加粗**、![图片](url)",
        )}
        placeholderTextColor="#9a8f8a"
        textAlignVertical="top"
        value={body}
        onChangeText={setBody}
      />

      <MarkdownPreviewPanel
        renderedMarkdown={previewBody.renderedMarkdown}
        rawDraft={previewBody.rawDraft}
        styles={styles}
        t={t}
      />

      <ImageUploadPanel
        images={images}
        onPickImage={() => void pickImage()}
        styles={styles}
        t={t}
      />

      <DocumentUploadPanel
        documents={documents}
        onPickDocument={() => void pickDocument()}
        onParseTextDocument={() => void parseTextDocument()}
        styles={styles}
        t={t}
      />

      <TagEditor
        tagInput={tagInput}
        tags={tags}
        onChangeTagInput={setTagInput}
        onAddTag={addTag}
        onRemoveTag={(tag) =>
          setTags((currentTags) =>
            currentTags.filter((item) => item !== tag),
          )
        }
        styles={styles}
        t={t}
      />

      <PublishActions
        isSubmitting={isSubmitting}
        onSubmit={(status) => void submitPost(status)}
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
