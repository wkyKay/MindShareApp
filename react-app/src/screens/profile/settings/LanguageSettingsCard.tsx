import { Pressable, Text, View } from "react-native";

import type { AppStyles } from "../../../components/styles";
import type { SupportedLanguage } from "../../../i18n";

type LanguageSettingsCardProps = {
  language: string;
  onSelectLanguage: (language: SupportedLanguage) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function LanguageSettingsCard({
  language,
  onSelectLanguage,
  styles,
  t,
}: LanguageSettingsCardProps) {
  return (
    <View style={styles.profileSettingsCard}>
      <Text style={styles.uploadTitle}>{t("语言")}</Text>
      <View style={styles.languageOptionList}>
        <Pressable
          style={[
            styles.languageOptionButton,
            language === "zh-CN" && styles.languageOptionButtonActive,
          ]}
          onPress={() => onSelectLanguage("zh-CN")}
        >
          <Text
            style={[
              styles.languageOptionText,
              language === "zh-CN" && styles.languageOptionTextActive,
            ]}
          >
            {t("中文")}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.languageOptionButton,
            language === "en-US" && styles.languageOptionButtonActive,
          ]}
          onPress={() => onSelectLanguage("en-US")}
        >
          <Text
            style={[
              styles.languageOptionText,
              language === "en-US" && styles.languageOptionTextActive,
            ]}
          >
            {t("profile.languageEnglish")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
