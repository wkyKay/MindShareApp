import { useCallback } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { styles } from '../components/styles';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

type NotificationScreenProps = {
  onOpenAuth: () => void;
  onOpenPost: (postId: number) => void;
};

export function NotificationScreen({ onOpenAuth, onOpenPost }: NotificationScreenProps) {
  const session = useAuthStore((state) => state.session);
  const notifications = useNotificationStore((state) => state.notifications);
  const refreshNotifications = useNotificationStore((state) => state.refreshNotifications);
  const markPostRead = useNotificationStore((state) => state.markPostRead);

  useFocusEffect(
    useCallback(() => {
      void refreshNotifications(session);
    }, [refreshNotifications, session])
  );

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.pageContent}>
        <Text style={styles.pageTitle}>消息通知</Text>
        <Text style={styles.profileBio}>登录后可以查看评论和回复通知。</Text>
        <Pressable style={styles.primaryButton} onPress={onOpenAuth}>
          <Text style={styles.primaryButtonText}>去登录</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.pageContent}
      data={notifications}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={<Text style={styles.pageTitle}>消息通知</Text>}
      ListEmptyComponent={<Text style={[styles.profileBio, { paddingTop: 16 }]}>暂时没有新的通知。</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.notificationCard, item.is_read && styles.notificationCardRead]}
          onPress={() => {
            void markPostRead(session, item.post_id);
            onOpenPost(item.post_id);
          }}
        >
          <View style={styles.notificationTitleRow}>
            <Text style={styles.notificationTitle}>{buildNotificationTitle(item)}</Text>
            {!item.is_read ? <View style={styles.cardNotificationDot} /> : null}
          </View>
          <Text style={[styles.notificationMeta, item.is_read && styles.notificationMetaRead]}>{item.created_at}</Text>
        </Pressable>
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

function buildNotificationTitle(item: { type: 'comment_created' | 'comment_reply'; actor: { display_name: string } }) {
  return item.type === 'comment_reply'
    ? `${item.actor.display_name} 回复了你的评论`
    : `${item.actor.display_name} 评论了你的帖子`;
}
