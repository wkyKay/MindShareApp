import { Pressable, Text, View } from 'react-native';

import { styles } from './styles';
import { useNotificationStore } from '../stores/notificationStore';

export type Page = 'home' | 'upload' | 'notifications' | 'profile' | 'auth';

type BottomTabsProps = {
  activePage: Exclude<Page, 'auth'>;
  onChangePage: (page: Exclude<Page, 'auth'>) => void;
};

export function BottomTabs({ activePage, onChangePage }: BottomTabsProps) {
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  return (
    <View style={styles.tabBar}>
      <TabButton active={activePage === 'home'} label="首页" onPress={() => onChangePage('home')} />
      <Pressable style={styles.createButton} onPress={() => onChangePage('upload')}>
        <Text style={styles.createButtonText}>＋</Text>
      </Pressable>
      <TabButton active={activePage === 'notifications'} label="消息" badgeCount={unreadCount} onPress={() => onChangePage('notifications')} />
      <TabButton active={activePage === 'profile'} label="我的" onPress={() => onChangePage('profile')} />
    </View>
  );
}

function TabButton({ active, label, badgeCount = 0, onPress }: { active: boolean; label: string; badgeCount?: number; onPress: () => void }) {
  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {badgeCount > 0 ? <View style={styles.tabBadge} /> : null}
    </Pressable>
  );
}
