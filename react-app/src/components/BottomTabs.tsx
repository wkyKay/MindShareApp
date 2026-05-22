import { Pressable, Text, View } from 'react-native';

import { styles } from './styles';

export type Page = 'home' | 'upload' | 'profile' | 'auth';

type BottomTabsProps = {
  activePage: Exclude<Page, 'auth'>;
  onChangePage: (page: Exclude<Page, 'auth'>) => void;
};

export function BottomTabs({ activePage, onChangePage }: BottomTabsProps) {
  return (
    <View style={styles.tabBar}>
      <TabButton active={activePage === 'home'} label="首页" onPress={() => onChangePage('home')} />
      <Pressable style={styles.createButton} onPress={() => onChangePage('upload')}>
        <Text style={styles.createButtonText}>＋</Text>
      </Pressable>
      <TabButton active={activePage === 'profile'} label="我的" onPress={() => onChangePage('profile')} />
    </View>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}
