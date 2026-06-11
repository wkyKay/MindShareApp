import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { AppStyles } from "../../components/styles";
import type { AuthSession } from "../../services/authSession";

type ProfileHeaderProps = {
  user: AuthSession["user"];
  avatarText: string;
  onPickAvatar: () => void;
  onOpenAnalytics: () => void;
  onOpenSettings: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function ProfileHeader({
  user,
  avatarText,
  onPickAvatar,
  onOpenAnalytics,
  onOpenSettings,
  styles,
  t,
}: ProfileHeaderProps) {
  return (
    <View style={styles.profileHeader}>
      <Pressable
        style={styles.avatar}
        onPress={onPickAvatar}
        accessibilityRole="button"
        accessibilityLabel={t("上传头像")}
      >
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{avatarText}</Text>
        )}
      </Pressable>
      <View style={styles.profileHeaderText}>
        <Text style={styles.pageTitle}>{user.display_name}</Text>
        <Text style={styles.profileBio}>
          {user.bio || `@${user.username} · ${user.email}`}
        </Text>
      </View>
      <View style={styles.profileHeaderActions}>
        <Pressable
          style={styles.profileAnalyticsButton}
          onPress={onOpenAnalytics}
          accessibilityRole="button"
          accessibilityLabel={t("查看资料分析")}
        >
          <Ionicons name="bar-chart-outline" size={22} color="#a05d6f" />
        </Pressable>
        <Pressable
          style={styles.profileAnalyticsButton}
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel={t("打开设置")}
        >
          <Ionicons name="settings-outline" size={22} color="#a05d6f" />
        </Pressable>
      </View>
    </View>
  );
}
