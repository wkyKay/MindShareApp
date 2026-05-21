import { Pressable, Text } from 'react-native';

import type { ProfileCollection } from '../services/profileApi';
import { styles } from './styles';

type CollectionCardProps = {
  collection: ProfileCollection;
  onPress: () => void;
};

export function CollectionCard({ collection, onPress }: CollectionCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.cardTitle}>{collection.title}</Text>
      {!!collection.description && <Text style={styles.cardSummary}>{collection.description}</Text>}
      <Text style={styles.cardMeta}>共 {collection.item_count ?? 0} 篇内容</Text>
    </Pressable>
  );
}
