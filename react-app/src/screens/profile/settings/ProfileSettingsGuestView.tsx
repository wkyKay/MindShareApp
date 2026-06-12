import { Pressable, ScrollView, Text } from "react-native";

import type { AppStyles } from "../../../components/styles";
import { ProfileSettingsHeader } from "./ProfileSettingsHeader";

type ProfileSettingsGuestViewProps = {
  onBack: () => void;
  onRequireAuth: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function ProfileSettingsGuestView({
  onBack,
  onRequireAuth,
  styles,
  t,
}: ProfileSettingsGuestViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <ProfileSettingsHeader onBack={onBack} styles={styles} t={t} />
      <Text style={styles.profileBio}>{t("请先登录后再修改个人信息。")}</Text>
      <Pressable style={styles.primaryButton} onPress={onRequireAuth}>
        <Text style={styles.primaryButtonText}>{t("去登录")}</Text>
      </Pressable>
    </ScrollView>
  );
}
