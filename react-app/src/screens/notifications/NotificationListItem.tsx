import { Pressable, Text, View } from "react-native";

import type { AppStyles } from "../../components/styles";
import type { NotificationItem } from "../../services/notificationsApi";
import { formatDateTimeMinute } from "../../utils/time";

type NotificationListItemProps = {
  item: NotificationItem;
  title: string;
  onPress: (item: NotificationItem) => void;
  styles: AppStyles;
};

export function NotificationListItem({
  item,
  title,
  onPress,
  styles,
}: NotificationListItemProps) {
  return (
    <Pressable
      style={[
        styles.notificationCard,
        item.is_read && styles.notificationCardRead,
      ]}
      onPress={() => onPress(item)}
    >
      <View style={styles.notificationTitleRow}>
        <Text style={styles.notificationTitle}>{title}</Text>
        {!item.is_read ? <View style={styles.cardNotificationDot} /> : null}
      </View>
      <Text
        style={[
          styles.notificationMeta,
          item.is_read && styles.notificationMetaRead,
        ]}
      >
        {formatDateTimeMinute(item.created_at)}
      </Text>
    </Pressable>
  );
}
