import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { AuthSession } from '../services/authSession';
import { createComment, deleteComment, getComments, setCommentLiked, type CommentItem } from '../services/commentsApi';
import { useAuthStore } from '../stores/authStore';
import { styles } from './styles';

type CommentSectionProps = {
  postId: number;
  session?: AuthSession | null;
  onRequireAuth: () => void;
  onCommentCountChange: (count: number) => void;
};

export function CommentSection({ postId, session, onRequireAuth, onCommentCountChange }: CommentSectionProps) {
  const storeSession = useAuthStore((state) => state.session);
  const requireAuthSession = useAuthStore((state) => state.requireSession);
  const currentSession = storeSession ?? session;
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [body, setBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommentItem | null>(null);
  const [expandedRoots, setExpandedRoots] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadComments() {
      setIsLoading(true);
      setMessage('');
      try {
        const data = await getComments(postId, currentSession?.accessToken);
        if (isMounted) {
          setComments(data.items);
          onCommentCountChange(data.total);
        }
      } catch (error) {
        if (isMounted) {
          setMessage(error instanceof Error ? error.message : '评论加载失败。');
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
    };
  }, [postId, currentSession?.accessToken]);

  const { roots, repliesByRoot } = useMemo(() => {
    const byId = new Map(comments.map((comment) => [comment.id, comment]));
    const replyMap = new Map<number, CommentItem[]>();
    const rootItems: CommentItem[] = [];

    function rootIdFor(comment: CommentItem): number {
      let current = comment;
      while (current.parent_id && byId.has(current.parent_id)) {
        const parent = byId.get(current.parent_id)!;
        if (!parent.parent_id) {
          return parent.id;
        }
        current = parent;
      }
      return current.parent_id || current.id;
    }

    for (const comment of comments) {
      if (comment.parent_id) {
        const rootId = rootIdFor(comment);
        replyMap.set(rootId, [...(replyMap.get(rootId) || []), comment]);
      } else {
        rootItems.push(comment);
      }
    }
    return { roots: rootItems, repliesByRoot: replyMap };
  }, [comments]);

  const commentsById = useMemo(() => new Map(comments.map((comment) => [comment.id, comment])), [comments]);

  async function requireSession() {
    const activeSession = await requireAuthSession();
    if (!activeSession) {
      onRequireAuth();
      return null;
    }
    return activeSession;
  }

  async function submitComment(parent?: CommentItem) {
    const text = (parent ? replyBody : body).trim();
    if (!text) {
      setMessage('评论不能为空。');
      return;
    }
    const activeSession = await requireSession();
    if (!activeSession) return;
    setMessage('');
    try {
      const created = await createComment(postId, text, activeSession.accessToken, parent?.id);
      setComments((current) => [...current, created]);
      onCommentCountChange(comments.length + 1);
      if (parent) {
        const rootId = findRootId(parent, commentsById);
        setExpandedRoots((current) => new Set(current).add(rootId));
        setReplyBody('');
        setReplyingTo(null);
      } else {
        setBody('');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '评论发布失败。');
    }
  }

  async function toggleLike(comment: CommentItem) {
    const activeSession = await requireSession();
    if (!activeSession) return;
    try {
      const data = await setCommentLiked(comment.id, !comment.is_liked, activeSession.accessToken);
      setComments((current) => current.map((item) => item.id === comment.id ? { ...item, is_liked: data.liked, like_count: data.like_count } : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '评论点赞失败。');
    }
  }

  async function removeComment(comment: CommentItem) {
    const activeSession = await requireSession();
    if (!activeSession) return;
    try {
      await deleteComment(comment.id, activeSession.accessToken);
      const deletedIds = comment.parent_id ? new Set<number>([comment.id]) : collectDeletedIds(comment.id, comments);
      setComments((current) => current
        .map((item) => comment.parent_id && item.parent_id === comment.id ? { ...item, parent_id: comment.parent_id } : item)
        .filter((item) => !deletedIds.has(item.id))
      );
      onCommentCountChange(Math.max(0, comments.length - deletedIds.size));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '评论删除失败。');
    }
  }

  function canDelete(comment: CommentItem) {
    return currentSession?.user.id === comment.author?.id;
  }

  function toggleRoot(rootId: number) {
    setExpandedRoots((current) => {
      const next = new Set(current);
      if (next.has(rootId)) {
        next.delete(rootId);
      } else {
        next.add(rootId);
      }
      return next;
    });
  }

  function renderComment(comment: CommentItem, nested = false) {
    const replies = nested ? [] : repliesByRoot.get(comment.id) || [];
    const isExpanded = expandedRoots.has(comment.id);
    const replyTarget = comment.parent_id ? commentsById.get(comment.parent_id) : null;
    return (
      <View key={comment.id} style={[styles.commentCard, nested && styles.commentReplyCard]}>
        <View style={styles.commentHeader}>
          <Text style={styles.cardAuthor}>
            {comment.author?.display_name || '匿名用户'}
            {replyTarget ? ` 回复 ${replyTarget.author?.display_name || '匿名用户'}` : ''}
          </Text>
          <Text style={styles.cardMeta}>{comment.created_at}</Text>
        </View>
        <Text style={styles.commentBody}>{comment.body}</Text>
        <View style={styles.compactActionRow}>
          <Pressable style={styles.compactActionButton} onPress={() => toggleLike(comment)}>
            <Ionicons name={comment.is_liked ? 'heart' : 'heart-outline'} size={14} color={comment.is_liked ? '#e74c3c' : '#a05d6f'} />
            <Text style={styles.compactActionText}> {comment.like_count}</Text>
          </Pressable>
          <Pressable style={styles.compactActionButton} onPress={() => setReplyingTo(comment)}>
            <Text style={styles.compactActionText}>回复</Text>
          </Pressable>
          {!nested && replies.length ? (
            <Pressable style={styles.compactActionButton} onPress={() => toggleRoot(comment.id)}>
              <Text style={styles.compactActionText}>{isExpanded ? '收起回复' : `展开 ${replies.length} 条回复`}</Text>
            </Pressable>
          ) : null}
          {canDelete(comment) ? (
            <Pressable style={[styles.compactActionButton, styles.compactDangerButton]} onPress={() => removeComment(comment)}>
              <Text style={[styles.compactActionText, styles.compactDangerText]}>删除</Text>
            </Pressable>
          ) : null}
        </View>
        {replyingTo?.id === comment.id ? (
          <View style={styles.replyComposer}>
            <TextInput
              style={[styles.input, styles.commentInput]}
              multiline
              placeholder={`回复 ${comment.author?.display_name || '评论'}`}
              placeholderTextColor="#a89994"
              value={replyBody}
              onChangeText={setReplyBody}
            />
            <View style={styles.actionRow}>
              <Pressable style={styles.actionButton} onPress={() => setReplyingTo(null)}>
                <Text style={styles.actionButtonText}>取消</Text>
              </Pressable>
              <Pressable style={[styles.actionButton, styles.actionButtonActive]} onPress={() => submitComment(comment)}>
                <Text style={styles.actionButtonText}>发送回复</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  function renderCommentThread(comment: CommentItem) {
    const replies = repliesByRoot.get(comment.id) || [];
    const isExpanded = expandedRoots.has(comment.id);
    return (
      <View key={`thread-${comment.id}`} style={styles.commentThread}>
        {renderComment(comment)}
        {replies.length && isExpanded ? replies.map((reply) => renderComment(reply, true)) : null}
      </View>
    );
  }

  return (
    <View style={styles.commentSection}>
      <Text style={styles.sectionTitle}>评论区</Text>
      <View style={styles.commentComposer}>
        <TextInput
          style={[styles.input, styles.commentInput]}
          multiline
          placeholder="写下你的评论..."
          placeholderTextColor="#a89994"
          value={body}
          onChangeText={setBody}
        />
        <Pressable style={styles.primaryButton} onPress={() => submitComment()}>
          <Text style={styles.primaryButtonText}>发布评论</Text>
        </Pressable>
      </View>
      {isLoading ? <Text style={styles.profileBio}>正在加载评论...</Text> : null}
      {message ? <Text style={[styles.authApiHint, { color: '#a05d6f' }]}>{message}</Text> : null}
      {!isLoading && roots.length === 0 ? <Text style={styles.profileBio}>暂无评论，来抢第一条。</Text> : null}
      {roots.map((comment) => renderCommentThread(comment))}
    </View>
  );
}

function findRootId(comment: CommentItem, commentsById: Map<number, CommentItem>) {
  let current = comment;
  while (current.parent_id && commentsById.has(current.parent_id)) {
    const parent = commentsById.get(current.parent_id)!;
    if (!parent.parent_id) {
      return parent.id;
    }
    current = parent;
  }
  return current.parent_id || current.id;
}

function collectDeletedIds(commentId: number, comments: CommentItem[]) {
  const deletedIds = new Set<number>([commentId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const comment of comments) {
      if (comment.parent_id && deletedIds.has(comment.parent_id) && !deletedIds.has(comment.id)) {
        deletedIds.add(comment.id);
        changed = true;
      }
    }
  }
  return deletedIds;
}
