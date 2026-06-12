import { Pressable, ScrollView, Text } from "react-native";

import type { AppStyles } from "../../components/styles";
import { NotificationHeader } from "./NotificationHeader";

type NotificationGuestViewProps = {
  onBack: () => void;
  onOpenAuth: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function NotificationGuestView({
  onBack,
  onOpenAuth,
  styles,
  t,
}: NotificationGuestViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <NotificationHeader
        title={t("消息通知")}
        onBack={onBack}
        styles={styles}
        t={t}
      />
      <Text style={styles.profileBio}>{t("登录后可以查看你的消息通知。")}</Text>
      <Pressable style={styles.primaryButton} onPress={onOpenAuth}>
        <Text style={styles.primaryButtonText}>{t("去登录")}</Text>
      </Pressable>
    </ScrollView>
  );
}
