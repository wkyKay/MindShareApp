import { Text, View } from 'react-native';

import type { SamplePost } from './samplePosts';
import { styles } from './styles';

type PostCardProps = {
  post: SamplePost;
  showAuthor?: boolean;
  showStats?: boolean;
};

export function PostCard({ post, showAuthor = false, showStats = false }: PostCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{post.title}</Text>
      {showAuthor && <Text style={styles.cardMeta}>作者：{post.author}</Text>}
      <Text style={styles.cardSummary}>{post.summary}</Text>
      {showStats && (
        <View style={styles.cardStats}>
          <Text style={styles.statText}>点赞 128</Text>
          <Text style={styles.statText}>评论 24</Text>
          <Text style={styles.statText}>收藏 56</Text>
        </View>
      )}
    </View>
  );
}
