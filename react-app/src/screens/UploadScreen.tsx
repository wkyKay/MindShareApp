import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { styles } from '../components/styles';
import { createPost, type CreatePostPayload } from '../services/postApi';
import { loadAuthSession, type AuthSession } from '../services/authSession';

type UploadScreenProps = {
  session: AuthSession | null;
  onCancel: () => void;
  onSaved: () => void;
};

export function UploadScreen({ session, onCancel, onSaved }: UploadScreenProps) {
  const [currentSession, setCurrentSession] = useState<AuthSession | null>(session);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      if (session) {
        setCurrentSession(session);
        return;
      }
      const storedSession = await loadAuthSession();
      if (isMounted) {
        setCurrentSession(storedSession);
      }
    }

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, [session]);

  function addTag() {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) {
      setTagInput('');
      return;
    }
    setTags((currentTags) => [...currentTags, tag]);
    setTagInput('');
  }

  async function submitPost(status: CreatePostPayload['status']) {
    setMessage('');

    if (!currentSession) {
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
          tags,
          visibility: status === 'draft' ? 'private' : 'public',
          status,
        },
        currentSession.accessToken
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
        placeholder="写下正文"
        placeholderTextColor="#9a8f8a"
        textAlignVertical="top"
        value={body}
        onChangeText={setBody}
      />

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
