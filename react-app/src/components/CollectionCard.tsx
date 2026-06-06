import { Pressable, Text, View } from "react-native";

import type { ProfileCollection } from "../services/profileApi";
import { styles } from "./styles";
import { useTranslation } from "react-i18next";

type CollectionCardProps = {
  collection: ProfileCollection;
  onPress: () => void;
  tone?: "default" | "favorite";
  actions?: { label: string; onPress: () => void; danger?: boolean }[];
};

export function CollectionCard({
  collection,
  onPress,
  tone = "default",
  actions = [],
}: CollectionCardProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      style={[
        styles.card,
        tone === "favorite" && styles.collectionFavoriteCard,
      ]}
      onPress={onPress}
    >
      {tone === "favorite" ? (
        <Text style={styles.collectionBadge}>{t("合集收藏")}</Text>
      ) : null}
      <Text style={styles.cardTitle}>{collection.title}</Text>
      {!!collection.description && (
        <Text style={styles.cardSummary}>{collection.description}</Text>
      )}
      <Text style={styles.cardMeta}>
        {t("共")} {collection.item_count ?? 0} {t("篇内容")}
      </Text>
      {collection.owner ? (
        <Text style={styles.cardAuthor}>
          {t("作者：")}
          {collection.owner.display_name}
        </Text>
      ) : null}
      {actions.length ? (
        <View style={styles.compactActionRow}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              style={[
                styles.compactActionButton,
                action.danger && styles.compactDangerButton,
              ]}
              onPress={(event) => {
                event.stopPropagation();
                action.onPress();
              }}
            >
              <Text
                style={[
                  styles.compactActionText,
                  action.danger && styles.compactDangerText,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}
