import { Pressable, Text, View } from 'react-native';

import { styles } from '../../components/styles';

export type ProfileTab = 'posts' | 'favorites' | 'collections' | 'following';

type ProfileStatsProps = {
  activeTab: ProfileTab;
  postsCount: number;
  favoritesCount: number;
  collectionsCount: number;
  followingCount: number;
  onSelectTab: (tab: ProfileTab) => void;
};

export function ProfileStats({ activeTab, postsCount, favoritesCount, collectionsCount, followingCount, onSelectTab }: ProfileStatsProps) {
  return (
    <View style={styles.profileStats}>
      <Pressable style={styles.profileStatItem} onPress={() => onSelectTab('posts')}>
        <Text style={styles.profileStatNumber}>{postsCount}</Text>
        <Text style={[styles.profileStatLabel, activeTab === 'posts' && styles.segmentTextActive]}>发布</Text>
      </Pressable>
      <Pressable style={styles.profileStatItem} onPress={() => onSelectTab('favorites')}>
        <Text style={styles.profileStatNumber}>{favoritesCount}</Text>
        <Text style={[styles.profileStatLabel, activeTab === 'favorites' && styles.segmentTextActive]}>收藏</Text>
      </Pressable>
      <Pressable style={styles.profileStatItem} onPress={() => onSelectTab('collections')}>
        <Text style={styles.profileStatNumber}>{collectionsCount}</Text>
        <Text style={[styles.profileStatLabel, activeTab === 'collections' && styles.segmentTextActive]}>合集</Text>
      </Pressable>
      <Pressable style={styles.profileStatItem} onPress={() => onSelectTab('following')}>
        <Text style={styles.profileStatNumber}>{followingCount}</Text>
        <Text style={[styles.profileStatLabel, activeTab === 'following' && styles.segmentTextActive]}>关注</Text>
      </Pressable>
    </View>
  );
}
