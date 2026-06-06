import { Pressable, ScrollView, Text, View } from "react-native";

import { styles } from "../../components/styles";
import { useTranslation } from "react-i18next";

type GuestProfileScreenProps = {
  onOpenAuth: () => void;
};

export function GuestProfileScreen({ onOpenAuth }: GuestProfileScreenProps) {
  const { t } = useTranslation();
  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarMuted}>
          <Text style={styles.avatarText}>{t("访")}</Text>
        </View>
        <View>
          <Text style={styles.pageTitle}>{t("我的主页")}</Text>
          <Text style={styles.profileBio}>
            {t("登录后管理发布、收藏与合集")}
          </Text>
        </View>
      </View>

      <View style={styles.authPromptCard}>
        <Text style={styles.authPromptTitle}>{t("进入创作者空间")}</Text>
        <Text style={styles.authPromptText}>
          {t("注册账号后即可发布同人作品、创建合集，并收藏喜欢的文章。")}
        </Text>
        <Pressable style={styles.primaryButton} onPress={onOpenAuth}>
          <Text style={styles.primaryButtonText}>{t("登录 / 注册")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
