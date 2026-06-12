import { Pressable, Text } from "react-native";

import type { AppStyles } from "../../../components/styles";

type AnalyticsStatusProps = {
  isAuthenticated: boolean;
  isLoading: boolean;
  message: string;
  onOpenAuth: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function AnalyticsStatus({
  isAuthenticated,
  isLoading,
  message,
  onOpenAuth,
  styles,
  t,
}: AnalyticsStatusProps) {
  return (
    <>
      {!isAuthenticated && !isLoading ? (
        <Pressable style={styles.primaryButton} onPress={onOpenAuth}>
          <Text style={styles.primaryButtonText}>{t("去登录")}</Text>
        </Pressable>
      ) : null}

      {isLoading ? (
        <Text style={styles.profileBio}>{t("正在生成你的内容画像...")}</Text>
      ) : null}
      {!!message ? (
        <Text style={[styles.authApiHint, { color: "#a05d6f" }]}>
          {message}
        </Text>
      ) : null}
    </>
  );
}
