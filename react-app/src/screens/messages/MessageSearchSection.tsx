import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, TextInput, View } from "react-native";

import type { AppStyles } from "../../components/styles";
import type { SearchUserItem } from "../../services/messagesApi";
import { MessageAvatar } from "./MessageAvatar";

type MessageSearchSectionProps = {
  query: string;
  results: SearchUserItem[];
  onChangeQuery: (query: string) => void;
  onStartChat: (partnerId: number, partnerName: string) => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function MessageSearchSection({
  query,
  results,
  onChangeQuery,
  onStartChat,
  styles,
  t,
}: MessageSearchSectionProps) {
  return (
    <>
      <View style={styles.messageSearchRow}>
        <TextInput
          style={styles.messageSearchInput}
          placeholder={t("搜索用户昵称或用户名")}
          placeholderTextColor="#9a8f8a"
          value={query}
          onChangeText={onChangeQuery}
        />

        <Ionicons name="search-outline" size={20} color="#a05d6f" />
      </View>

      {results.length > 0 ? (
        <View style={styles.messageSearchResults}>
          {results.map((user) => (
            <Pressable
              key={`search-${user.id}`}
              style={styles.messageUserRow}
              onPress={() => onStartChat(user.id, user.display_name)}
            >
              <MessageAvatar
                name={user.display_name}
                avatarUrl={user.avatar_url}
                styles={styles}
              />

              <View style={styles.messageRowTextBlock}>
                <Text style={styles.cardTitle}>{user.display_name}</Text>
                <Text style={styles.profileBio}>@{user.username}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}
