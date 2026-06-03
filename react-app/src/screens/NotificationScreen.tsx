import { useCallback } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { styles } from '../components/styles';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

type NotificationScreenProps = {
  onOpenAuth: () => void;
  onBack: () => void;
  category: 'comments' | 'likes' | 'follows';
  onOpenPost: (postId: number, focusCommentId?: number) => void;
  onOpenAuthor: (authorId: number) => void;
};

export function NotificationScreen({ onOpenAuth, onBack, category, onOpenPost, onOpenAuthor }: NotificationScreenProps) {
  const session = useAuthStore((state) => state.session);
  const notifications = useNotificationStore((state) => state.notifications);
  const filteredNotifications = notifications.filter((item) => matchesCategory(item.type, category));
  const refreshNotifications = useNotificationStore((state) => state.refreshNotifications);
  const markPostRead = useNotificationStore((state) => state.markPostRead);
  const markNotificationRead = useNotificationStore((state) => state.markNotificationRead);

  useFocusEffect(
    useCallback(() => {
      void refreshNotifications(session);
    }, [refreshNotifications, session])
  );

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.pageHeaderRow}>
          <Pressable style={styles.backButtonCompact} onPress={onBack}>
            <Text style={styles.backButtonText}>‹ 返回</Text>
          </Pressable>
          <Text style={styles.pageTitle}>消息通知</Text>
        </View>
        <Text style={styles.profileBio}>登录后可以查看你的消息通知。</Text>
        <Pressable style={styles.primaryButton} onPress={onOpenAuth}>
          <Text style={styles.primaryButtonText}>去登录</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
      <FlatList
        contentContainerStyle={styles.pageContent}
      data={filteredNotifications}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={(
        <View style={styles.pageHeaderRow}>
          <Pressable style={styles.backButtonCompact} onPress={onBack}>
            <Text style={styles.backButtonText}>‹ 返回</Text>
          </Pressable>
          <Text style={styles.pageTitle}>{getCategoryTitle(category)}</Text>
        </View>
      )}
      ListEmptyComponent={<Text style={[styles.profileBio, { paddingTop: 16 }]}>暂时没有这类通知。</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.notificationCard, item.is_read && styles.notificationCardRead]}
          onPress={() => {
            void markNotificationRead(session, item.id);
            if (item.type === 'user_followed') {
              onOpenAuthor(item.actor.id);
              return;
            }
            if (item.post_id > 0) {
              void markPostRead(session, item.post_id);
              onOpenPost(item.post_id, item.comment_id > 0 ? item.comment_id : undefined);
            }
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

function getCategoryTitle(category: 'comments' | 'likes' | 'follows') {
  if (category === 'comments') return '评论我的';
  if (category === 'likes') return '赞和喜欢';
  return '关注我的';
}

function matchesCategory(type: string, category: 'comments' | 'likes' | 'follows') {
  if (category === 'comments') {
    return type === 'comment_created' || type === 'comment_reply';
  }
  if (category === 'likes') {
    return type === 'post_liked' || type === 'comment_liked';
  }
  return type === 'user_followed';
}

function buildNotificationTitle(item: { type: 'comment_created' | 'comment_reply' | 'comment_liked' | 'post_liked' | 'post_favorited' | 'collection_favorited' | 'user_followed'; actor: { display_name: string }; post_title?: string | null }) {
  const postTitle = 'post_title' in item && item.post_title ? `《${item.post_title}》` : '';
  if (item.type === 'user_followed') {
    return `${item.actor.display_name} 关注了你`;
  }
  if (item.type === 'post_liked') {
    return `${item.actor.display_name} 点赞了你的帖子${postTitle}`;
  }
  if (item.type === 'post_favorited') {
    return `${item.actor.display_name} 收藏了你的帖子${postTitle}`;
  }
  if (item.type === 'collection_favorited') {
    return `${item.actor.display_name} 收藏了你的合集`;
  }
  if (item.type === 'comment_liked') {
    return `${item.actor.display_name} 点赞了你的评论${postTitle}`;
  }
  return item.type === 'comment_reply'
    ? `${item.actor.display_name} 回复了你在${postTitle}中的评论`
    : `${item.actor.display_name} 评论了你的帖子${postTitle}`;
}
