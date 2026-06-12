import { Pressable, Text } from "react-native";

import type { AppStyles } from "../../../components/styles";

type ProfileSettingsHeaderProps = {
  onBack: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function ProfileSettingsHeader({
  onBack,
  styles,
  t,
}: ProfileSettingsHeaderProps) {
  return (
    <>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
      </Pressable>
      <Text style={styles.pageTitle}>{t("个人设置")}</Text>
    </>
  );
}
