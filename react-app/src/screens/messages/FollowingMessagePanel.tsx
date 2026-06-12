import { Pressable, ScrollView, Text, View } from "react-native";

import type { AppStyles } from "../../components/styles";
import type { SearchUserItem } from "../../services/messagesApi";
import { MessageAvatar } from "./MessageAvatar";

type FollowingMessagePanelProps = {
  following: SearchUserItem[];
  onStartChat: (partnerId: number, partnerName: string) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function FollowingMessagePanel({
  following,
  onStartChat,
  styles,
  t,
}: FollowingMessagePanelProps) {
  return (
    <View style={styles.messagePanel}>
      <Text style={styles.sectionTitle}>{t("关注的人")}</Text>
      {following.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.followingMessageScroller}
        >
          {following.map((user) => (
            <Pressable
              key={`follow-${user.id}`}
              style={styles.followingMessageItem}
              onPress={() => onStartChat(user.id, user.display_name)}
            >
              <MessageAvatar
                name={user.display_name}
                avatarUrl={user.avatar_url}
                styles={styles}
              />

              <Text style={styles.followingMessageName} numberOfLines={1}>
                {user.display_name}
              </Text>
              <Text style={styles.followingMessageUsername} numberOfLines={1}>
                @{user.username}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.profileBio}>{t("暂无关注用户。")}</Text>
      )}
    </View>
  );
}
