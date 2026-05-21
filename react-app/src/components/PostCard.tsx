import { Pressable, Text, View } from 'react-native';

import { styles } from './styles';

export type PostCardPost = {
  id: number;
  title: string;
  summary?: string | null;
  author?: string | { display_name: string };
  like_count?: number;
  comment_count?: number;
  favorite_count?: number;
};

type PostCardProps = {
  post: PostCardPost;
  showAuthor?: boolean;
  showStats?: boolean;
  onPress?: () => void;
};

export function PostCard({ post, showAuthor = false, showStats = false, onPress }: PostCardProps) {
  const author = typeof post.author === 'string' ? post.author : post.author?.display_name;
  const content = (
    <>
      <Text style={styles.cardTitle}>{post.title}</Text>
      {showAuthor && !!author && <Text style={styles.cardMeta}>作者：{author}</Text>}
      {!!post.summary && <Text style={styles.cardSummary}>{post.summary}</Text>}
      {showStats && (
        <View style={styles.cardStats}>
          <Text style={styles.statText}>点赞 {post.like_count ?? 0}</Text>
          <Text style={styles.statText}>评论 {post.comment_count ?? 0}</Text>
          <Text style={styles.statText}>收藏 {post.favorite_count ?? 0}</Text>
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <Pressable style={styles.card} onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      {content}
    </View>
  );
}
