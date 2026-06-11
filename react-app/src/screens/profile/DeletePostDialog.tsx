import { Modal, Pressable, Text, View } from "react-native";

import type { AppStyles } from "../../components/styles";
import type { ProfilePost } from "../../services/profileApi";

type DeletePostDialogProps = {
  post: ProfilePost | null;
  onCancel: () => void;
  onConfirm: (post: ProfilePost) => void;
  styles: AppStyles;
  t: (key: string, options?: Record<string, string>) => string;
};

export function DeletePostDialog({
  post,
  onCancel,
  onConfirm,
  styles,
  t,
}: DeletePostDialogProps) {
  return (
    <Modal visible={!!post} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmDialog}>
          <Text style={styles.confirmTitle}>{t("删除博客？")}</Text>
          <Text style={styles.confirmMessage}>
            {t("删除后这篇内容将不再展示。确认删除《{{title}}》吗？", {
              title: post?.title || "",
            })}
          </Text>
          <View style={styles.confirmActionRow}>
            <Pressable
              style={[styles.confirmButton, styles.confirmCancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.confirmCancelText}>{t("取消")}</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmButton, styles.confirmDangerButton]}
              onPress={() => post && onConfirm(post)}
            >
              <Text style={styles.confirmDangerText}>{t("确认删除")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
