import { Image, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { AppStyles } from "../../components/styles";

type MessageAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  styles: AppStyles;
};

export function MessageAvatar({ name, avatarUrl, styles }: MessageAvatarProps) {
  const { t } = useTranslation();
  const initial = name.trim().slice(0, 1) || t("聊");

  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.messageAvatar} />;
  }

  return (
    <View style={styles.messageAvatarFallback}>
      <Text style={styles.messageAvatarText}>{initial}</Text>
    </View>
  );
}
