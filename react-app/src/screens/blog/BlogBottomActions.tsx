import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { AppStyles } from "../../components/styles";
import type { AppColors } from "../../theme/colors";

type BlogBottomActionsProps = {
  isOwner: boolean;
  isLiked: boolean;
  isFavorited: boolean;
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
  onToggleLike: () => void;
  onToggleFavorite: () => void;
  styles: AppStyles;
  colors: AppColors;
};

export function BlogBottomActions({
  isOwner,
  isLiked,
  isFavorited,
  likeCount,
  commentCount,
  favoriteCount,
  onToggleLike,
  onToggleFavorite,
  styles,
  colors,
}: BlogBottomActionsProps) {
  return (
    <View style={styles.blogBottomActions}>
      <Pressable
        style={styles.blogBottomActionButton}
        onPress={isOwner ? undefined : onToggleLike}
        disabled={isOwner}
      >
        <Ionicons
          name={isLiked ? "heart" : "heart-outline"}
          size={22}
          color={isLiked ? colors.danger : colors.textMuted}
        />

        <Text style={styles.blogBottomActionText}>{likeCount}</Text>
      </Pressable>
      <View style={styles.blogBottomActionButton}>
        <Ionicons name="chatbubble-outline" size={21} color={colors.textMuted} />
        <Text style={styles.blogBottomActionText}>{commentCount}</Text>
      </View>
      <Pressable
        style={styles.blogBottomActionButton}
        onPress={isOwner ? undefined : onToggleFavorite}
        disabled={isOwner}
      >
        <Ionicons
          name={isFavorited ? "star" : "star-outline"}
          size={22}
          color={isFavorited ? colors.warningText : colors.textMuted}
        />

        <Text style={styles.blogBottomActionText}>{favoriteCount}</Text>
      </Pressable>
    </View>
  );
}
