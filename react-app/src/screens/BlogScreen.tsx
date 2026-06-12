import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { BlogDetailSkeleton } from "../components/Skeleton";
import { useDelayedLoading } from "../hooks/useDelayedLoading";
import { getPost, type PostDetail } from "../services/postApi";
import type { AuthSession } from "../services/authSession";
import { useAuthStore } from "../stores/authStore";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../theme/ThemeProvider";
import { BlogLoadedView } from "./blog/BlogLoadedView";
import { useBlogEditor } from "./blog/hooks/useBlogEditor";
import { useBlogImages } from "./blog/hooks/useBlogImages";
import { useBlogPostActions } from "./blog/hooks/useBlogPostActions";
import { useBlogTranslation } from "./blog/hooks/useBlogTranslation";

type BlogScreenProps = {
  postId: number;
  session: AuthSession | null;
  focusCommentId?: number;
  startEditing?: boolean;
  onBack: () => void;
  onDeleted: () => void;
  onRequireAuth: () => void;
  onOpenAuthor: (authorId: number) => void;
  onOpenTag: (tag: string) => void;
};

export function BlogScreen({
  postId,
  session,
  focusCommentId,
  startEditing = false,
  onOpenAuthor,
  onOpenTag,
  onBack,
  onDeleted,
  onRequireAuth,
}: BlogScreenProps) {
  const { colors, styles } = useAppTheme();
  const storeSession = useAuthStore((state) => state.session);
  const requireAuthSession = useAuthStore((state) => state.requireSession);
  const currentSession = storeSession ?? session;
  const [post, setPost] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const showSkeleton = useDelayedLoading(isLoading, 250);
  const { i18n, t } = useTranslation();
  const { handleImageRatio, imageRatios, previewImageUrl, setPreviewImageUrl } =
    useBlogImages();
  const {
    body,
    isEditing,
    title,
    cancelEdit,
    resetEditor,
    saveEdit,
    setBody,
    setTitle,
  } = useBlogEditor({
    currentSession,
    setMessage,
    setPost,
  });
  const { requireSession, toggleFavorite, toggleLike } =
    useBlogPostActions({
      currentSession,
      onDeleted,
      onRequireAuth,
      requireAuthSession,
      setMessage,
      setPost,
    });
  const {
    isBodyTranslationVisible,
    isTranslatingBody,
    resetBodyTranslation,
    toggleBodyTranslation,
    translatedBody,
  } = useBlogTranslation({
    language: i18n.language,
    requireSession,
    setMessage,
    t,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadPost() {
      setIsLoading(true);
      setMessage("");
      try {
        const data = await getPost(postId, currentSession?.accessToken);
        if (isMounted) {
          setPost(data);
          resetEditor(data, startEditing && data.is_owner);
          resetBodyTranslation();
        }
      } catch (error) {
        if (isMounted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "博客加载失败，请稍后重试。",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPost();

    return () => {
      isMounted = false;
    };
  }, [
    postId,
    currentSession?.accessToken,
    resetBodyTranslation,
    resetEditor,
    startEditing,
  ]);

  const handleCommentCountChange = useCallback((commentCount: number) => {
    setPost((currentPost) =>
      currentPost
        ? { ...currentPost, comment_count: commentCount }
        : currentPost,
    );
  }, []);

  const handleSaveEdit = useCallback(() => {
    void saveEdit(post);
  }, [post, saveEdit]);

  const handleToggleBodyTranslation = useCallback(() => {
    void toggleBodyTranslation(post);
  }, [post, toggleBodyTranslation]);

  const handleToggleFavorite = useCallback(() => {
    void toggleFavorite(post);
  }, [post, toggleFavorite]);

  const handleToggleLike = useCallback(() => {
    void toggleLike(post);
  }, [post, toggleLike]);

  if (showSkeleton) {
    return <BlogDetailSkeleton onBack={onBack} />;
  }

  if (isLoading) {
    return <View style={styles.pageContent} />;
  }

  if (!post) {
    return (
      <View style={styles.pageContent}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>{t("‹ 返回")}</Text>
        </Pressable>
        <Text style={[styles.authApiHint, { color: colors.primaryText }]}>
          {message || "博客不存在。"}
        </Text>
      </View>
    );
  }

  return (
    <BlogLoadedView
      body={body}
      focusCommentId={focusCommentId}
      imageRatios={imageRatios}
      isBodyTranslationVisible={isBodyTranslationVisible}
      isEditing={isEditing}
      isTranslatingBody={isTranslatingBody}
      message={message}
      onBack={onBack}
      onCancelEdit={cancelEdit}
      onChangeBody={setBody}
      onChangeTitle={setTitle}
      onCommentCountChange={handleCommentCountChange}
      onImageRatio={handleImageRatio}
      onOpenAuthor={onOpenAuthor}
      onOpenTag={onOpenTag}
      onPreviewImage={setPreviewImageUrl}
      onRequireAuth={onRequireAuth}
      onSaveEdit={handleSaveEdit}
      onToggleBodyTranslation={handleToggleBodyTranslation}
      onToggleFavorite={handleToggleFavorite}
      onToggleLike={handleToggleLike}
      post={post}
      previewImageUrl={previewImageUrl}
      session={currentSession}
      title={title}
      translatedBody={translatedBody}
    />
  );
}
