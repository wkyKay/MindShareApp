import { Pressable, Text, View } from "react-native";

import type { AuthMode } from "../../services/authApi";
import { useTranslation } from "react-i18next";
import { useAppStyles } from "../../theme/ThemeProvider";

type AuthModeTabsProps = {
  mode: AuthMode;
  onChangeMode: (mode: AuthMode) => void;
};

export function AuthModeTabs({ mode, onChangeMode }: AuthModeTabsProps) {
  const styles = useAppStyles();
  const isLogin = mode === "login";
  const { t } = useTranslation();

  return (
    <View style={styles.segmentedControl}>
      <Pressable
        style={[styles.segmentButton, isLogin && styles.segmentButtonActive]}
        onPress={() => onChangeMode("login")}
      >
        <Text style={[styles.segmentText, isLogin && styles.segmentTextActive]}>
          {t("登录")}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.segmentButton, !isLogin && styles.segmentButtonActive]}
        onPress={() => onChangeMode("register")}
      >
        <Text
          style={[styles.segmentText, !isLogin && styles.segmentTextActive]}
        >
          {t("注册")}
        </Text>
      </Pressable>
    </View>
  );
}
