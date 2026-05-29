import { Pressable, Text, View } from 'react-native';

import { styles } from '../../components/styles';
import type { ProfileCollection, ProfilePost } from '../../services/profileApi';

type MovePostPanelProps = {
  post: ProfilePost;
  collections: ProfileCollection[];
  isOpen: boolean;
  onOpen: () => void;
  onMoveToCollection: (collection: ProfileCollection) => void;
  onCancel: () => void;
};

export function MovePostPanel({ post, collections, isOpen, onOpen, onMoveToCollection, onCancel }: MovePostPanelProps) {
  return (
    <View style={[styles.movePostPanel, isOpen && styles.movePostPanelOpen]}>
      <View style={styles.compactActionRow}>
        <Pressable style={styles.compactActionButton} onPress={onOpen}>
          <Text style={styles.compactActionText}>添加到合集</Text>
        </Pressable>
      </View>

      {isOpen ? (
        <View>
          <Text style={styles.movePostTitle}>将《{post.title}》移入合集</Text>
          {collections.length ? (
            <View style={styles.movePostCollectionList}>
              {collections.map((collection) => (
                <Pressable key={collection.id} style={styles.compactActionButton} onPress={() => onMoveToCollection(collection)}>
                  <Text style={styles.compactActionText}>{collection.title}</Text>
                </Pressable>
              ))}
            </View>
          ) : <Text style={styles.movePostHint}>还没有合集，先创建一个合集。</Text>}
          <Pressable style={styles.backButton} onPress={onCancel}>
            <Text style={styles.backButtonText}>取消移动</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
