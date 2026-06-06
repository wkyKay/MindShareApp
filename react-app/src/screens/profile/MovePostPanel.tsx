import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { ProfileCollection, ProfilePost } from "../../services/profileApi";
import { useTranslation } from "react-i18next";
import { useAppStyles } from "../../theme/ThemeProvider";

type MovePostPanelProps = {
  post: ProfilePost;
  collections: ProfileCollection[];
  isOpen: boolean;
  onMoveToCollection: (collection: ProfileCollection) => void;
  onCancel: () => void;
};

export function MovePostPanel({
  post,
  collections,
  isOpen,
  onMoveToCollection,
  onCancel,
}: MovePostPanelProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  if (!isOpen) {
    return null;
  }

  return (
    <View style={[styles.movePostPanel, styles.movePostPanelOpen]}>
      <View style={styles.movePostTitleRow}>
        <Text style={styles.movePostTitle}>
          {t("将《{{title}}》加入合集", { title: post.title })}
        </Text>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Ionicons name="close" size={20} color="#8d7b75" />
        </Pressable>
      </View>
      {collections.length ? (
        <View style={styles.movePostCollectionList}>
          {collections.map((collection) => (
            <Pressable
              key={collection.id}
              style={styles.compactActionButton}
              onPress={() => onMoveToCollection(collection)}
            >
              <Text style={styles.compactActionText}>{collection.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.movePostHint}>
          {t("还没有合集，先创建一个合集。")}
        </Text>
      )}
    </View>
  );
}
