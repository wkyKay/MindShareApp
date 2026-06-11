import { Image, Modal, Pressable, Text } from "react-native";

import type { AppStyles } from "../../components/styles";

type BlogImagePreviewModalProps = {
  imageUrl: string | null;
  onClose: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function BlogImagePreviewModal({
  imageUrl,
  onClose,
  styles,
  t,
}: BlogImagePreviewModalProps) {
  return (
    <Modal
      visible={!!imageUrl}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.imagePreviewOverlay} onPress={onClose}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            resizeMode="contain"
            style={styles.imagePreview}
          />
        ) : null}
        <Text style={styles.imagePreviewHint}>{t("点击关闭")}</Text>
      </Pressable>
    </Modal>
  );
}
