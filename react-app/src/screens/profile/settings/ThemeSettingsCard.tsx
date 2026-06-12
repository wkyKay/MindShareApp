import { Pressable, Text, View } from "react-native";

import type { AppStyles } from "../../../components/styles";
import type { AppThemeMode } from "../../../theme/colors";

type ThemeSettingsCardProps = {
  mode: AppThemeMode;
  onSelectThemeMode: (themeMode: AppThemeMode) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function ThemeSettingsCard({
  mode,
  onSelectThemeMode,
  styles,
  t,
}: ThemeSettingsCardProps) {
  return (
    <View style={styles.profileSettingsCard}>
      <Text style={styles.uploadTitle}>{t("外观")}</Text>
      <View style={styles.languageOptionList}>
        {(
          [
            ["system", t("跟随系统")],
            ["light", t("浅色")],
            ["dark", t("深色")],
          ] as const
        ).map(([themeMode, label]) => (
          <Pressable
            key={themeMode}
            style={[
              styles.languageOptionButton,
              mode === themeMode && styles.languageOptionButtonActive,
            ]}
            onPress={() => onSelectThemeMode(themeMode)}
          >
            <Text
              style={[
                styles.languageOptionText,
                mode === themeMode && styles.languageOptionTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
