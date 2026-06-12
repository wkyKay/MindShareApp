import { Text } from "react-native";

import type { AppStyles } from "../../components/styles";

type NotificationListEmptyProps = {
  styles: AppStyles;
  t: (key: string) => string;
};

export function NotificationListEmpty({
  styles,
  t,
}: NotificationListEmptyProps) {
  return (
    <Text style={[styles.profileBio, { paddingTop: 16 }]}>
      {t("暂时没有这类通知。")}
    </Text>
  );
}
