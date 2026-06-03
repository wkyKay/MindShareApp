import { Pressable, Text, View } from 'react-native';

import { MarkdownText } from './MarkdownText';
import { styles } from './styles';

export type PostCardPost = {
  id: number;
  title: string;
  summary?: string | null;
  author?: string | { display_name: string };
  status?: string;
  like_count?: number;
  comment_count?: number;
  favorite_count?: number;
  is_deleted?: boolean;
  tags?: string[];
};

type PostCardProps = {
  post: PostCardPost;
  showAuthor?: boolean;
  showStats?: boolean;
  hasCommentNotification?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onOpenTag?: (tag: string) => void;
};

export function PostCard({ post, showAuthor = false, showStats = false, hasCommentNotification = false, onPress, onLongPress, onOpenTag }: PostCardProps) {
  const isDeleted = post.is_deleted || post.status === 'deleted';
  const author = typeof post.author === 'string' ? post.author : post.author?.display_name;
  const isDraft = post.status === 'draft';
  const cardStyle = [styles.card, isDraft && styles.draftCard, isDeleted && styles.deletedCard];
  const content = (
    <>
      {isDeleted && <Text style={styles.deletedBadge}>已删除</Text>}
      {isDraft && <Text style={styles.draftBadge}>草稿</Text>}
      <View style={styles.cardTitleRow}>
        <Text style={[styles.cardTitle, isDeleted && styles.deletedText]}>{isDeleted ? '该博客已删除' : post.title}</Text>
        {hasCommentNotification ? <View style={styles.cardNotificationDot} /> : null}
      </View>
      {!isDeleted && showAuthor && !!author && <Text style={styles.cardMeta}>作者：{author}</Text>}
      {!isDeleted && !!post.summary && (
        <View style={styles.cardMarkdownSummary}>
          <MarkdownText>{post.summary}</MarkdownText>
        </View>
      )}
      {!isDeleted && !!post.tags?.length && (
        <View style={styles.tagList}>
          {post.tags.map((tag) => (
            <Pressable key={tag} style={styles.tagChip} onPress={() => onOpenTag?.(tag)}>
              <Text style={styles.tagChipText}>#{tag}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {!isDeleted && showStats && (
        <View style={styles.cardStats}>
          <Text style={styles.statText}>点赞 {post.like_count ?? 0}</Text>
          <Text style={styles.statText}>评论 {post.comment_count ?? 0}</Text>
          <Text style={styles.statText}>收藏 {post.favorite_count ?? 0}</Text>
        </View>
      )}
    </>
  );

  if (onPress && !isDeleted) {
    return (
      <Pressable style={({ pressed }) => [cardStyle, pressed && styles.cardPressed]} onPress={onPress} onLongPress={onLongPress} delayLongPress={320}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle}>
      {content}
    </View>
  );
}
