import { Pressable, Text, TextInput, View } from "react-native";

import type { CaptchaResponse } from "../../services/authApi";
import { useTranslation } from "react-i18next";
import { useAppStyles } from "../../theme/ThemeProvider";

type CaptchaFieldProps = {
  captcha: CaptchaResponse | null;
  refreshCount: number;
  value: string;
  onChangeText: (value: string) => void;
  onRefresh: () => void;
};

export function CaptchaField({
  captcha,
  refreshCount,
  value,
  onChangeText,
  onRefresh,
}: CaptchaFieldProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  return (
    <View style={styles.captchaRow}>
      <TextInput
        style={styles.captchaInput}
        placeholder={t("验证码")}
        placeholderTextColor="#9a8f8a"
        autoCapitalize="characters"
        value={value}
        onChangeText={onChangeText}
      />

      <Pressable style={styles.captchaImage} onPress={onRefresh}>
        <Text style={styles.captchaCode}>
          {captcha ? captcha.captcha_key.slice(-4).toUpperCase() : "..."}
        </Text>
        <Text style={styles.captchaHint}>
          {captcha ? "换一张" : "加载中"} #{refreshCount}
        </Text>
      </Pressable>
    </View>
  );
}
