import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { PostCard } from '../components/PostCard';
import { samplePosts } from '../components/samplePosts';
import { styles } from '../components/styles';
import { clearAuthSession, refreshAuthSession, type AuthSession } from '../services/authSession';


type ProfileScreenProps = {
  onOpenAuth: () => void;
};

export function ProfileScreen({ onOpenAuth }: ProfileScreenProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const refreshedSession = await refreshAuthSession();
        if (isMounted) {
          setSession(refreshedSession);
        }
      } catch {
        await clearAuthSession();
        if (isMounted) {
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.pageContent}>
        <Text style={styles.pageTitle}>我的主页</Text>
        <Text style={styles.profileBio}>正在加载账号信息...</Text>
      </ScrollView>
    );
  }

  if (!session) {
    return (
      <ScrollView contentContainerStyle={styles.pageContent}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarMuted}>
            <Text style={styles.avatarText}>访</Text>
          </View>
          <View>
            <Text style={styles.pageTitle}>我的主页</Text>
            <Text style={styles.profileBio}>登录后管理发布、收藏与合集</Text>
          </View>
        </View>

        <View style={styles.authPromptCard}>
          <Text style={styles.authPromptTitle}>进入创作者空间</Text>
          <Text style={styles.authPromptText}>注册账号后即可发布同人作品、创建合集，并收藏喜欢的文章。</Text>
          <Pressable style={styles.primaryButton} onPress={onOpenAuth}>
            <Text style={styles.primaryButtonText}>登录 / 注册</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return <LoggedInProfile session={session} onLoggedOut={() => setSession(null)} />;
}

type LoggedInProfileProps = {
  session: AuthSession;
  onLoggedOut: () => void;
};

function LoggedInProfile({ session, onLoggedOut }: LoggedInProfileProps) {
  async function logout() {
    await clearAuthSession();
    onLoggedOut();
  }

  const avatarText = session.user.display_name.slice(0, 1) || session.user.username.slice(0, 1) || '我';

  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarText}</Text>
        </View>
        <View>
          <Text style={styles.pageTitle}>{session.user.display_name}</Text>
          <Text style={styles.profileBio}>{session.user.bio || `@${session.user.username} · ${session.user.email}`}</Text>
        </View>
      </View>

      <Pressable style={styles.backButton} onPress={logout}>
        <Text style={styles.backButtonText}>退出登录</Text>
      </Pressable>

      <View style={styles.profileStats}>
        <View style={styles.profileStatItem}>
          <Text style={styles.profileStatNumber}>2</Text>
          <Text style={styles.profileStatLabel}>发布</Text>
        </View>
        <View style={styles.profileStatItem}>
          <Text style={styles.profileStatNumber}>5</Text>
          <Text style={styles.profileStatLabel}>收藏</Text>
        </View>
        <View style={styles.profileStatItem}>
          <Text style={styles.profileStatNumber}>1</Text>
          <Text style={styles.profileStatLabel}>合集</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>我的内容</Text>
      {samplePosts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </ScrollView>
  );
}
