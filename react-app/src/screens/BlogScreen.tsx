import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';

import { markdownStyles, styles } from '../components/styles';
import { CommentSection } from '../components/CommentSection';
import { MarkdownText } from '../components/MarkdownText';
import {
  deletePost,
  getPost,
  setPostFavorited,
  setPostLiked,
  updatePost,
  type PostDetail,
} from '../services/postApi';
import type { AuthSession } from '../services/authSession';
import { useAuthStore } from '../stores/authStore';
import { Ionicons } from '@expo/vector-icons';

type BlogScreenProps = {
  postId: number;
  session: AuthSession | null;
  focusCommentId?: number;
  onBack: () => void;
  onDeleted: () => void;
  onRequireAuth: () => void;
  onOpenAuthor: (authorId: number) => void;
  onOpenTag: (tag: string) => void;
};

export function BlogScreen({ postId, session, focusCommentId, onOpenAuthor, onOpenTag, onBack, onDeleted, onRequireAuth }: BlogScreenProps) {
  const storeSession = useAuthStore((state) => state.session);
  const requireAuthSession = useAuthStore((state) => state.requireSession);
  const currentSession = storeSession ?? session;
  const [post, setPost] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadPost() {
      setIsLoading(true);
      setMessage('');
      try {
        const data = await getPost(postId, currentSession?.accessToken);
        if (isMounted) {
          setPost(data);
          setTitle(data.title);
          setBody(data.body);
        }
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : '博客加载失败，请稍后重试。');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPost();

    return () => {
      isMounted = false;
    };
  }, [postId, currentSession?.accessToken]);

  async function requireSession() {
    const activeSession = await requireAuthSession();
    if (!activeSession) {
      onRequireAuth();
      return null;
    }
    return activeSession;
  }

  async function toggleLike() {
    if (!post) {
      return;
    }
    const activeSession = await requireSession();
    if (!activeSession) {
      return;
    }
    try {
      const data = await setPostLiked(post.id, !post.is_liked, activeSession.accessToken);
      setPost({ ...post, is_liked: data.liked, like_count: data.like_count });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '点赞失败。');
    }
  }

  async function toggleFavorite() {
    if (!post) {
      return;
    }
    const activeSession = await requireSession();
    if (!activeSession) {
      return;
    }
    try {
      const data = await setPostFavorited(post.id, !post.is_favorited, activeSession.accessToken);
      setPost({ ...post, is_favorited: data.favorited, favorite_count: data.favorite_count });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '收藏失败。');
    }
  }

  async function saveEdit() {
    if (!post || !currentSession) {
      return;
    }
    if (!title.trim() || !body.trim()) {
      setMessage('标题和正文不能为空。');
      return;
    }
    try {
      await updatePost(post.id, { title: title.trim(), body: body.trim(), summary: body.trim().slice(0, 120) }, currentSession.accessToken);
      setPost({ ...post, title: title.trim(), body: body.trim(), summary: body.trim().slice(0, 120) });
      setIsEditing(false);
      setMessage('已保存修改。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败。');
    }
  }

  async function removePost() {
    if (!post || !currentSession) {
      return;
    }
    try {
      await deletePost(post.id, currentSession.accessToken);
      onDeleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败。');
    }
  }

  const handleCommentCountChange = useCallback((commentCount: number) => {
    setPost((currentPost) => currentPost ? { ...currentPost, comment_count: commentCount } : currentPost);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.pageContent}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.profileBio}>正在加载博客...</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.pageContent}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>‹ 返回</Text>
        </Pressable>
        <Text style={[styles.authApiHint, { color: '#a05d6f' }]}>{message || '博客不存在。'}</Text>
      </View>
    );
  }

  const content = isEditing ? (
    <>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>‹ 返回</Text>
      </Pressable>
      <TextInput style={styles.input} placeholder="标题" placeholderTextColor="#9a8f8a" value={title} onChangeText={setTitle} />
      <TextInput
        multiline
        style={[styles.input, styles.bodyInput, styles.longBodyInput]}
        placeholder="正文"
        placeholderTextColor="#9a8f8a"
        textAlignVertical="top"
        value={body}
        onChangeText={setBody}
      />
      <Pressable style={styles.primaryButton} onPress={saveEdit}>
        <Text style={styles.primaryButtonText}>保存修改</Text>
      </Pressable>
      <Pressable style={styles.draftButton} onPress={() => setIsEditing(false)}>
        <Text style={styles.draftButtonText}>取消编辑</Text>
      </Pressable>
    </>
  ) : (
    <>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>‹ 返回</Text>
      </Pressable>
      <Text style={styles.pageTitle}>{post.title}</Text>
      <Pressable onPress={() => onOpenAuthor(post.author.id)}>
        <Text style={styles.cardAuthor}>{post.author.display_name}</Text>
      </Pressable>
      <Text style={styles.cardMeta}>发布时间：{post.created_at}</Text>
      {post.tags.length > 0 && (
        <View style={styles.tagList}>
          {post.tags.map((tag) => (
            <Pressable key={tag} style={styles.tagChip} onPress={() => onOpenTag(tag)}>
              <Text style={styles.tagChipText}>#{tag}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {post.image_urls.length > 0 ? (
        <View style={styles.inlineImageList}>
          {post.image_urls.map((imageUrl) => (
            <Image
              key={imageUrl}
              source={{ uri: imageUrl }}
              resizeMode="contain"
              style={[styles.blogImage, imageRatios[imageUrl] ? { aspectRatio: imageRatios[imageUrl] } : null]}
              onLoad={(event) => {
                const { width, height } = event.nativeEvent.source;
                if (width && height) {
                  setImageRatios((current) => current[imageUrl] === width / height ? current : { ...current, [imageUrl]: width / height });
                }
              }}
            />
          ))}
        </View>
      ) : null}
      <MarkdownText style={markdownStyles}>{post.body}</MarkdownText>

      <View style={styles.actionRow}>
        <Text style={styles.statText}>点赞 {post.like_count}</Text>
        <Text style={styles.statText}>评论 {post.comment_count}</Text>
        <Text style={styles.statText}>收藏 {post.favorite_count}</Text>
      </View>

      {!post.is_owner && (
        <View style={styles.actionRow}>
          <Pressable onPress={toggleLike}>
            <Ionicons
              name={post.is_liked ? 'heart' : 'heart-outline'}
              size={20}
              color={post.is_liked ? '#e74c3c' : '#9a8f8a'}
            />
          </Pressable>

          <Pressable onPress={toggleFavorite}>
            <Ionicons
              name={post.is_favorited ? 'star' : 'star-outline'}
              size={20}
              color={post.is_favorited ? '#f39c12' : '#9a8f8a'}
            />
          </Pressable>
        </View>
      )}
      {post.is_owner && (
        <>
          <Pressable style={styles.primaryButton} onPress={() => setIsEditing(true)}>
            <Text style={styles.primaryButtonText}>编辑</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={removePost}>
            <Text style={styles.dangerButtonText}>删除</Text>
          </Pressable>
        </>
      )}
      {!!message && <Text style={[styles.authApiHint, { color: '#a05d6f' }]}>{message}</Text>}
    </>
  );

  return (
    <CommentSection
      postId={post.id}
      session={currentSession}
      focusCommentId={focusCommentId}
      headerComponent={content}
      onRequireAuth={onRequireAuth}
      onCommentCountChange={handleCommentCountChange}
    />
  );
}
