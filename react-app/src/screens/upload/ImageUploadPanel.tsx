import { Pressable, Text, View } from "react-native";

import { LazyImage } from "../../components/LazyImage";
import type { AppStyles } from "../../components/styles";

type UploadedImage = {
  id: number;
  url: string;
};

type ImageUploadPanelProps = {
  images: UploadedImage[];
  onPickImage: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function ImageUploadPanel({
  images,
  onPickImage,
  styles,
  t,
}: ImageUploadPanelProps) {
  return (
    <View style={styles.uploadBox}>
      <Text style={styles.uploadTitle}>{t("插入图片")}</Text>
      <Text style={styles.uploadHint}>
        {t("选择图片后会自动上传，并把 Markdown 图片语法插入正文。")}
      </Text>
      <Pressable style={styles.secondaryButton} onPress={onPickImage}>
        <Text style={styles.secondaryButtonText}>{t("选择图片")}</Text>
      </Pressable>
      {images.length > 0 ? (
        <View style={styles.inlineImageList}>
          {images.map((image) => (
            <LazyImage
              key={image.id}
              uri={image.url}
              style={styles.inlineImagePreview}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
