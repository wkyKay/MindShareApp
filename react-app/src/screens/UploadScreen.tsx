import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { MarkdownText } from '../components/MarkdownText';
import { styles } from '../components/styles';
import { createPost, parsePostDocument, uploadPostDocument, uploadPostImage, type CreatePostPayload } from '../services/postApi';
import type { AuthSession } from '../services/authSession';
import { useAuthStore } from '../stores/authStore';

type UploadScreenProps = {
  session: AuthSession | null;
  onCancel: () => void;
  onSaved: () => void;
};

function splitPreviewBody(body: string) {
  const lastNewlineIndex = body.lastIndexOf('\n');
  if (lastNewlineIndex === -1) {
    return { renderedMarkdown: '', rawDraft: body };
  }

  return {
    renderedMarkdown: body.slice(0, lastNewlineIndex + 1),
    rawDraft: body.slice(lastNewlineIndex + 1),
  };
}

export function UploadScreen({ session, onCancel, onSaved }: UploadScreenProps) {
  const storeSession = useAuthStore((state) => state.session);
  const requireAuthSession = useAuthStore((state) => state.requireSession);
  const currentSession = storeSession ?? session;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<{ id: number; url: string }[]>([]);
  const [documents, setDocuments] = useState<{ id: number; name: string; url: string }[]>([]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewBody = splitPreviewBody(body);

  function addTag() {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) {
      setTagInput('');
      return;
    }
    setTags((currentTags) => [...currentTags, tag]);
    setTagInput('');
  }

  async function pickImage() {
    setMessage('');
    const activeSession = currentSession ?? (await requireAuthSession());
    if (!activeSession) {
      setMessage('请先登录后再上传图片。');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage('需要相册权限才能插入图片。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets.length) {
      return;
    }
    try {
      const asset = result.assets[0];
      const uploaded = await uploadPostImage(asset.uri, asset.fileName || `post-${Date.now()}.jpg`, activeSession.accessToken);
      const uploadedUrl = uploaded.url;
      if (!uploadedUrl) {
        throw new Error('图片上传成功，但未返回可访问地址。');
      }
      setImages((current) => [...current, { id: uploaded.id, url: uploadedUrl }]);
      const imageMarkdown = `![图片](${uploadedUrl})`;
      setBody((current) => `${current}${current.trim() ? '\n\n' : ''}${imageMarkdown}\n`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '图片上传失败。');
    }
  }

  async function pickDocument() {
    setMessage('');
    const activeSession = currentSession ?? (await requireAuthSession());
    if (!activeSession) {
      setMessage('请先登录后再上传文件。');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/markdown',
        'text/x-markdown',
        'text/plain',
      ],
    });
    if (result.canceled || !result.assets.length) {
      return;
    }

    try {
      const asset = result.assets[0];
      const uploaded = await uploadPostDocument(asset.uri, asset.name || `document-${Date.now()}`, activeSession.accessToken, asset.mimeType);
      const uploadedUrl = uploaded.url;
      if (!uploadedUrl) {
        throw new Error('文件上传成功，但未返回可访问地址。');
      }
      const documentName = uploaded.original_name || asset.name || '附件';
      setDocuments((current) => [...current, { id: uploaded.id, name: documentName, url: uploadedUrl }]);
      setBody((current) => `${current}${current.trim() ? '\n\n' : ''}[附件：${documentName}](${uploadedUrl})\n`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '文件上传失败。');
    }
  }

  async function parseTextDocument() {
    setMessage('');
    const activeSession = currentSession ?? (await requireAuthSession());
    if (!activeSession) {
      setMessage('请先登录后再解析文件。');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: '*/*',
    });
    if (result.canceled || !result.assets.length) {
      return;
    }

    try {
      const asset = result.assets[0];
      const lowerName = asset.name.toLowerCase();
      if (!lowerName.endsWith('.md') && !lowerName.endsWith('.docx')) {
        setMessage('请选择 .md Markdown 或 .docx Word 文件。');
        return;
      }
      const parsed = await parsePostDocument(asset.uri, asset.name || `markdown-${Date.now()}.md`, activeSession.accessToken, asset.mimeType);
      if (!parsed.extracted_text?.trim()) {
        setMessage('Markdown 文件没有解析出正文内容。');
        return;
      }
      const importedMarkdown = `## 来自文件：${parsed.original_name}\n\n${parsed.extracted_text.trim()}\n`;
      setBody((current) => `${current}${current.trim() ? '\n\n' : ''}${importedMarkdown}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '文件解析失败。');
    }
  }

  async function submitPost(status: CreatePostPayload['status']) {
    setMessage('');

    const activeSession = currentSession ?? (await requireAuthSession());
    if (!activeSession) {
      setMessage('请先登录后再发布。');
      return;
    }
    if (!title.trim() || !body.trim()) {
      setMessage('请填写标题和正文。');
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
          visibility: status === 'draft' ? 'private' : 'public',
          status,
        },
        activeSession.accessToken
      );
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '上传失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <View style={styles.pageHeaderRow}>
        <Pressable style={styles.backButtonCompact} onPress={onCancel}>
          <Text style={styles.backButtonText}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.pageTitle}>发布博客</Text>
      </View>
      <TextInput style={styles.input} placeholder="标题" placeholderTextColor="#9a8f8a" value={title} onChangeText={setTitle} />
      <TextInput
        multiline
        style={[styles.input, styles.bodyInput, styles.longBodyInput]}
        placeholder="写下正文，支持 Markdown，例如 # 标题、**加粗**、![图片](url)"
        placeholderTextColor="#9a8f8a"
        textAlignVertical="top"
        value={body}
        onChangeText={setBody}
      />

      <View style={styles.uploadPreviewPanel}>
        <Text style={styles.uploadTitle}>渲染预览</Text>
        {body.trim() ? (
          <>
            {previewBody.renderedMarkdown.trim() ? (
              <View style={styles.renderedParagraphCard}>
                <MarkdownText>{previewBody.renderedMarkdown}</MarkdownText>
              </View>
            ) : null}
            {previewBody.rawDraft.trim() ? (
              <View style={styles.editingParagraphCard}>
                <Text style={styles.rawPreviewText}>{previewBody.rawDraft}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.uploadHint}>上方输入 Markdown 后，这里会实时显示渲染效果。</Text>
        )}
      </View>

      <View style={styles.uploadBox}>
        <Text style={styles.uploadTitle}>插入图片</Text>
        <Text style={styles.uploadHint}>选择图片后会自动上传，并把 Markdown 图片语法插入正文。</Text>
        <Pressable style={styles.secondaryButton} onPress={() => void pickImage()}>
          <Text style={styles.secondaryButtonText}>选择图片</Text>
        </Pressable>
        {images.length > 0 ? (
          <View style={styles.inlineImageList}>
            {images.map((image) => (
              <Image key={image.id} source={{ uri: image.url }} style={styles.inlineImagePreview} />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.uploadBox}>
        <Text style={styles.uploadTitle}>插入文件</Text>
        <Text style={styles.uploadHint}>支持 PDF、Word（.doc/.docx）和 Markdown（.md）。选择后会自动上传，并把文件链接插入正文；也可以把 .md/.docx 解析成正文。</Text>
        <Pressable style={styles.secondaryButton} onPress={() => void pickDocument()}>
          <Text style={styles.secondaryButtonText}>选择文件</Text>
        </Pressable>
        <Pressable style={[styles.secondaryButton, styles.uploadStackedButton]} onPress={() => void parseTextDocument()}>
          <Text style={styles.secondaryButtonText}>解析 Markdown/Word 到正文</Text>
        </Pressable>
        {documents.length > 0 ? (
          <View style={styles.documentList}>
            {documents.map((document) => (
              <Text key={document.id} style={styles.documentListItem}>附件：{document.name}</Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.tagPanel}>
        <Text style={styles.uploadTitle}>添加 Tag</Text>
        <View style={styles.tagInputRow}>
          <TextInput
            style={styles.tagInput}
            placeholder="输入标签"
            placeholderTextColor="#9a8f8a"
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={addTag}
          />
          <Pressable style={styles.tagAddButton} onPress={addTag}>
            <Text style={styles.tagAddButtonText}>增加</Text>
          </Pressable>
        </View>
        {tags.length > 0 && (
          <View style={styles.tagList}>
            {tags.map((tag) => (
              <Pressable key={tag} style={styles.tagChip} onPress={() => setTags((currentTags) => currentTags.filter((item) => item !== tag))}>
                <Text style={styles.tagChipText}>#{tag} ×</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Pressable style={[styles.primaryButton, isSubmitting && { opacity: 0.65 }]} onPress={() => submitPost('published')} disabled={isSubmitting}>
        <Text style={styles.primaryButtonText}>{isSubmitting ? '提交中...' : '上传'}</Text>
      </Pressable>
      <Pressable style={[styles.draftButton, isSubmitting && { opacity: 0.65 }]} onPress={() => submitPost('draft')} disabled={isSubmitting}>
        <Text style={styles.draftButtonText}>保存草稿</Text>
      </Pressable>
      {!!message && <Text style={[styles.authApiHint, { color: '#a05d6f' }]}>{message}</Text>}
    </ScrollView>
  );
}
