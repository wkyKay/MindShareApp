import { Text } from "react-native";

import type { AppStyles } from "../../components/styles";

type ProfileListFooterProps = {
  isLoading: boolean;
  message: string;
  styles: AppStyles;
  t: (key: string) => string;
};

export function ProfileListFooter({
  isLoading,
  message,
  styles,
  t,
}: ProfileListFooterProps) {
  if (isLoading) {
    return (
      <Text style={[styles.profileBio, { padding: 16, textAlign: "center" }]}> 
        {t("正在加载内容...")}
      </Text>
    );
  }

  if (message) {
    return (
      <Text
        style={[
          styles.authApiHint,
          { color: "#a05d6f", textAlign: "center", padding: 16 },
        ]}
      >
        {message}
      </Text>
    );
  }

  return null;
}
