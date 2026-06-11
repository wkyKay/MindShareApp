import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { AppStyles } from "../../components/styles";

type MessageShortcutProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  unreadCount: number;
  onPress: () => void;
  styles: AppStyles;
};

export function MessageShortcut({
  icon,
  label,
  unreadCount,
  onPress,
  styles,
}: MessageShortcutProps) {
  return (
    <Pressable style={styles.messageShortcutCard} onPress={onPress}>
      <View style={styles.messageShortcutIconWrap}>
        <Ionicons name={icon} size={25} color="#d94f70" />
        {unreadCount > 0 ? <View style={styles.messageShortcutDot} /> : null}
      </View>
      <Text style={styles.messageShortcutLabel}>{label}</Text>
    </Pressable>
  );
}
