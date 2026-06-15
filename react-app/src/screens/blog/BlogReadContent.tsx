import { Pressable, Text, View } from "react-native";

import { LazyImage } from "../../components/LazyImage";
import { MarkdownText } from "../../components/MarkdownText";
import type { AppStyles } from "../../components/styles";
import type { PostDetail } from "../../services/postApi";
import { formatDateTimeMinute } from "../../utils/time";

type BlogReadContentProps = {
  post: PostDetail;
  message: string;
  primaryTextColor: string;
  translatedBody: string | null;
  isBodyTranslationVisible: boolean;
  isTranslatingBody: boolean;
  imageRatios: Record<string, number>;
  onBack: () => void;
  onOpenAuthor: (authorId: number) => void;
  onOpenTag: (tag: string) => void;
  onPreviewImage: (imageUrl: string) => void;
  onImageRatio: (imageUrl: string, ratio: number) => void;
  onToggleBodyTranslation: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function BlogReadContent({
  post,
  message,
  primaryTextColor,
  translatedBody,
  isBodyTranslationVisible,
  isTranslatingBody,
  imageRatios,
  onBack,
  onOpenAuthor,
  onOpenTag,
  onPreviewImage,
  onImageRatio,
  onToggleBodyTranslation,
  styles,
  t,
}: BlogReadContentProps) {
  return (
    <>
      <Pressable style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
      </Pressable>
      <Text style={styles.pageTitle}>{post.title}</Text>
      <Pressable onPress={() => onOpenAuthor(post.author.id)}>
        <Text style={styles.cardAuthor}>{post.author.display_name}</Text>
      </Pressable>
      <Text style={styles.cardMeta}>
        {t("发布时间：")}
        {formatDateTimeMinute(post.created_at)}
      </Text>
      {post.tags.length > 0 ? (
        <View style={styles.tagList}>
          {post.tags.map((tag) => (
            <Pressable key={tag} style={styles.tagChip} onPress={() => onOpenTag(tag)}>
              <Text style={styles.tagChipText}>#{tag}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {post.image_urls.length > 0 ? (
        <View style={styles.inlineImageList}>
          {post.image_urls.map((imageUrl) => (
            <Pressable key={imageUrl} onPress={() => onPreviewImage(imageUrl)}>
              <LazyImage
                uri={imageUrl}
                resizeMode="contain"
                style={[
                  styles.blogImage,
                  imageRatios[imageUrl]
                    ? { aspectRatio: imageRatios[imageUrl] }
                    : null,
                ]}
                onLoad={(event) => {
                  const { width, height } = event.nativeEvent.source;
                  if (width && height) {
                    onImageRatio(imageUrl, width / height);
                  }
                }}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
      <MarkdownText>
        {isBodyTranslationVisible && translatedBody ? translatedBody : post.body}
      </MarkdownText>
      <Pressable
        style={styles.translationInlineAction}
        onPress={onToggleBodyTranslation}
        disabled={isTranslatingBody}
      >
        <Text style={styles.translationInlineText}>
          {isTranslatingBody
            ? t("翻译中...")
            : isBodyTranslationVisible
              ? t("查看原文")
              : t("查看译文")}
        </Text>
      </Pressable>
      {!!message && (
        <Text style={[styles.authApiHint, { color: primaryTextColor }]}> 
          {message}
        </Text>
      )}
    </>
  );
}
