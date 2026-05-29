import { useCallback, useRef } from 'react';
import { ScrollView, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { styles } from '../components/styles';
import { useAuthStore } from '../stores/authStore';
import { GuestProfileScreen } from './profile/GuestProfileScreen';
import { LoggedInProfileScreen } from './profile/LoggedInProfileScreen';

type ProfileScreenProps = {
  onOpenAuth: () => void;
  onOpenPost: (postId: number) => void;
  onOpenAuthor: (authorId: number) => void;
  onOpenTag: (tag: string) => void;
};

export function ProfileScreen({ onOpenAuth, onOpenPost, onOpenAuthor, onOpenTag }: ProfileScreenProps) {
  const session = useAuthStore((state) => state.session);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const refreshAuth = useAuthStore((state) => state.refresh);
  const hasLoaded = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (hasLoaded.current) return;
      hasLoaded.current = true;

      async function loadProfile() {
        if (isMounted) {
          await refreshAuth();
        }
      }

      void loadProfile();

      return () => {
        isMounted = false;
      };
    }, [refreshAuth])
  );

  if (isAuthLoading) {
    return (
      <ScrollView contentContainerStyle={styles.pageContent}>
        <Text style={styles.pageTitle}>我的主页</Text>
        <Text style={styles.profileBio}>正在加载账号信息...</Text>
      </ScrollView>
    );
  }

  if (!session) {
    return <GuestProfileScreen onOpenAuth={onOpenAuth} />;
  }

  return (
    <LoggedInProfileScreen
      session={session}
      onOpenPost={onOpenPost}
      onOpenAuthor={onOpenAuthor}
      onOpenTag={onOpenTag}
    />
  );
}
