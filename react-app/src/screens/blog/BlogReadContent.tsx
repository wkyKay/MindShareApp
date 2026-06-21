import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { LazyImage } from "../../components/LazyImage";
import { MarkdownSection, MarkdownText, splitMarkdownSections } from "../../components/MarkdownText";
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
  const displayBody =
    isBodyTranslationVisible && translatedBody ? translatedBody : post.body;

  const sections = useMemo(
    () => splitMarkdownSections(displayBody),
    [displayBody],
  );

  const metadata = useMemo(
    () => (
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
              <Pressable
                key={tag}
                style={styles.tagChip}
                onPress={() => onOpenTag(tag)}
              >
                <Text style={styles.tagChipText}>#{tag}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {post.image_urls.length > 0 ? (
          <View style={styles.inlineImageList}>
            {post.image_urls.map((img) => (
              <Pressable key={img.url} onPress={() => onPreviewImage(img.url)}>
                <LazyImage
                  uri={img.url}
                  thumbnailUri={img.thumbnail_url ?? undefined}
                  resizeMode="contain"
                  style={[
                    styles.blogImage,
                    imageRatios[img.url]
                      ? { aspectRatio: imageRatios[img.url] }
                      : null,
                  ]}
                  onLoad={(event) => {
                    const { width, height } = event.source;
                    if (width && height) {
                      onImageRatio(img.url, width / height);
                    }
                  }}
                />
              </Pressable>
            ))}
          </View>
        ) : null}
      </>
    ),
    [
      imageRatios,
      onBack,
      onImageRatio,
      onOpenAuthor,
      onOpenTag,
      onPreviewImage,
      post.author.display_name,
      post.author.id,
      post.created_at,
      post.image_urls,
      post.tags,
      post.title,
      styles.backButton,
      styles.backButtonText,
      styles.blogImage,
      styles.cardAuthor,
      styles.cardMeta,
      styles.inlineImageList,
      styles.pageTitle,
      styles.tagChip,
      styles.tagChipText,
      styles.tagList,
      t,
    ],
  );

  const footer = useMemo(
    () => (
      <>
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
    ),
    [
      isBodyTranslationVisible,
      isTranslatingBody,
      message,
      onToggleBodyTranslation,
      primaryTextColor,
      styles.authApiHint,
      styles.translationInlineAction,
      styles.translationInlineText,
      t,
    ],
  );

  // Short content: skip section splitting overhead
  if (sections.length <= 3) {
    return (
      <>
        {metadata}
        <MarkdownText>{displayBody}</MarkdownText>
        {footer}
      </>
    );
  }

  return (
    <>
      {metadata}
      {sections.map((section, index) => (
        <MarkdownSection key={index} content={section} />
      ))}
      {footer}
    </>
  );
}
