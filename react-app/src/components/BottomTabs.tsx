import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useMessageStore } from "../stores/messageStore";
import { useNotificationStore } from "../stores/notificationStore";
import { useAppStyles } from "../theme/ThemeProvider";

export type Page =
  | "home"
  | "aiChat"
  | "messages"
  | "upload"
  | "profile"
  | "auth";

type BottomTabsProps = {
  activePage: Exclude<Page, "auth">;
  onChangePage: (page: Exclude<Page, "auth">) => void;
};

export function BottomTabs({ activePage, onChangePage }: BottomTabsProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const messageUnreadCount = useMessageStore((state) => state.unreadCount);
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  return (
    <View style={styles.tabBar}>
      <TabButton
        active={activePage === "home"}
        label={t("首页")}
        onPress={() => onChangePage("home")}
      />

      <TabButton
        active={activePage === "aiChat"}
        label={t("AI聊天")}
        onPress={() => onChangePage("aiChat")}
      />

      <Pressable
        style={styles.createButton}
        onPress={() => onChangePage("upload")}
      >
        <Text style={styles.createButtonText}>＋</Text>
      </Pressable>
      <TabButton
        active={activePage === "messages"}
        label={t("消息")}
        badgeCount={unreadCount + messageUnreadCount}
        onPress={() => onChangePage("messages")}
      />

      <TabButton
        active={activePage === "profile"}
        label={t("我的")}
        onPress={() => onChangePage("profile")}
      />
    </View>
  );
}

function TabButton({
  active,
  label,
  badgeCount = 0,
  onPress,
}: {
  active: boolean;
  label: string;
  badgeCount?: number;
  onPress: () => void;
}) {
  const styles = useAppStyles();
  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
      {badgeCount > 0 ? <View style={styles.tabBadge} /> : null}
    </Pressable>
  );
}
