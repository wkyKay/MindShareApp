import { Pressable, Text, View } from "react-native";

import { LazyImage } from "../../../components/LazyImage";
import type { AppStyles } from "../../../components/styles";

type ProfileBackgroundCardProps = {
  backgroundUrl: string;
  onPickBackground: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function ProfileBackgroundCard({
  backgroundUrl,
  onPickBackground,
  styles,
  t,
}: ProfileBackgroundCardProps) {
  return (
    <View style={styles.profileSettingsCard}>
      <Text style={styles.uploadTitle}>{t("主页背景图")}</Text>
      {backgroundUrl ? (
        <LazyImage uri={backgroundUrl} style={styles.profileBackgroundPreview} />
      ) : (
        <View style={styles.profileBackgroundPlaceholder}>
          <Text style={styles.profileBio}>{t("暂无背景图")}</Text>
        </View>
      )}
      <Pressable style={styles.secondaryButton} onPress={onPickBackground}>
        <Text style={styles.secondaryButtonText}>{t("选择背景图")}</Text>
      </Pressable>
    </View>
  );
}
