import { Pressable, ScrollView, Text } from "react-native";

import type { AppStyles } from "../../components/styles";

type MessagesGuestViewProps = {
  onOpenAuth: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function MessagesGuestView({
  onOpenAuth,
  styles,
  t,
}: MessagesGuestViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <Text style={styles.pageTitle}>{t("消息")}</Text>
      <Text style={styles.profileBio}>{t("登录后可以查看互动消息和私信。")}</Text>
      <Pressable style={styles.primaryButton} onPress={onOpenAuth}>
        <Text style={styles.primaryButtonText}>{t("去登录")}</Text>
      </Pressable>
    </ScrollView>
  );
}
