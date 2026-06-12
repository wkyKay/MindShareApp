import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import type { AuthSession } from "../../../services/authSession";
import {
  parsePostDocument,
  uploadPostDocument,
  uploadPostImage,
} from "../../../services/postApi";

type UploadedImage = { id: number; url: string };
type UploadedDocument = { id: number; name: string; url: string };

type UseUploadAssetsOptions = {
  currentSession: AuthSession | null;
  requireAuthSession: () => Promise<AuthSession | null>;
  setBody: React.Dispatch<React.SetStateAction<string>>;
  setMessage: (message: string) => void;
  t: (key: string, options?: Record<string, string>) => string;
};

export function useUploadAssets({
  currentSession,
  requireAuthSession,
  setBody,
  setMessage,
  t,
}: UseUploadAssetsOptions) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);

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

  return {
    documents,
    images,
    parseTextDocument,
    pickDocument,
    pickImage,
  };
}
