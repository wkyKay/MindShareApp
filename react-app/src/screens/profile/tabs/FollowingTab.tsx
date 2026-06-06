import { Pressable, Text, View } from "react-native";

import type { FollowingUser } from "../../../services/profileApi";
import { useAppStyles } from "../../../theme/ThemeProvider";

type FollowingTabItemProps = {
  user: FollowingUser;
  onOpenAuthor: (authorId: number) => void;
};

export function FollowingTabItem({
  user,
  onOpenAuthor,
}: FollowingTabItemProps) {
  const styles = useAppStyles();
  const avatarText =
    user.display_name.slice(0, 1) || user.username.slice(0, 1) || "关";
  return (
    <Pressable style={styles.card} onPress={() => onOpenAuthor(user.id)}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarMuted}>
          <Text style={styles.avatarText}>{avatarText}</Text>
        </View>
        <View>
          <Text style={styles.cardTitle}>{user.display_name}</Text>
          <Text style={styles.profileBio}>@{user.username}</Text>
          {user.bio ? <Text style={styles.cardSummary}>{user.bio}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}
