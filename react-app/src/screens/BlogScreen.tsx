import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { CommentSection } from "../components/CommentSection";
import { BlogDetailSkeleton } from "../components/Skeleton";
import { useDelayedLoading } from "../hooks/useDelayedLoading";
import {
  deletePost,
  getPost,
  setPostFavorited,
  setPostLiked,
  updatePost,
  type PostDetail,
} from "../services/postApi";
import { translateContent } from "../services/translationsApi";
import type { AuthSession } from "../services/authSession";
import { useAuthStore } from "../stores/authStore";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../theme/ThemeProvider";
import { BlogBottomActions } from "./blog/BlogBottomActions";
import { BlogEditForm } from "./blog/BlogEditForm";
import { BlogImagePreviewModal } from "./blog/BlogImagePreviewModal";
import { BlogReadContent } from "./blog/BlogReadContent";

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
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const showSkeleton = useDelayedLoading(isLoading, 250);
  const { i18n, t } = useTranslation();
  const [translatedBody, setTranslatedBody] = useState<string | null>(null);
  const [isBodyTranslationVisible, setIsBodyTranslationVisible] =
    useState(false);
  const [isTranslatingBody, setIsTranslatingBody] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadPost() {
      setIsLoading(true);
      setMessage("");
      try {
        const data = await getPost(postId, currentSession?.accessToken);
        if (isMounted) {
          setPost(data);
          setTitle(data.title);
          setBody(data.body);
          setTranslatedBody(null);
          setIsBodyTranslationVisible(false);
          setIsEditing(startEditing && data.is_owner);
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
  }, [postId, currentSession?.accessToken, startEditing]);

  async function requireSession() {
    const activeSession = await requireAuthSession();
    if (!activeSession) {
      onRequireAuth();
      return null;
    }
    return activeSession;
  }

  async function toggleLike() {
    if (!post) {
      return;
    }
    const activeSession = await requireSession();
    if (!activeSession) {
      return;
    }
    try {
      const data = await setPostLiked(
        post.id,
        !post.is_liked,
        activeSession.accessToken,
      );
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPost({ ...post, is_liked: data.liked, like_count: data.like_count });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "点赞失败。");
    }
  }

  async function toggleFavorite() {
    if (!post) {
      return;
    }
    const activeSession = await requireSession();
    if (!activeSession) {
      return;
    }
    try {
      const data = await setPostFavorited(
        post.id,
        !post.is_favorited,
        activeSession.accessToken,
      );
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPost({
        ...post,
        is_favorited: data.favorited,
        favorite_count: data.favorite_count,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "收藏失败。");
    }
  }

  async function saveEdit() {
    if (!post || !currentSession) {
      return;
    }
    if (!title.trim() || !body.trim()) {
      setMessage("标题和正文不能为空。");
      return;
    }
    try {
      await updatePost(
        post.id,
        {
          title: title.trim(),
          body: body.trim(),
          summary: body.trim().slice(0, 120),
        },
        currentSession.accessToken,
      );
      setPost({
        ...post,
        title: title.trim(),
        body: body.trim(),
        summary: body.trim().slice(0, 120),
      });
      setIsEditing(false);
      setMessage("已保存修改。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败。");
    }
  }

  async function removePost() {
    if (!post || !currentSession) {
      return;
    }
    try {
      await deletePost(post.id, currentSession.accessToken);
      onDeleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败。");
    }
  }

  async function toggleBodyTranslation() {
    if (!post) {
      return;
    }
    if (isBodyTranslationVisible) {
      setIsBodyTranslationVisible(false);
      return;
    }
    if (translatedBody) {
      setIsBodyTranslationVisible(true);
      return;
    }
    const activeSession = await requireSession();
    if (!activeSession) {
      return;
    }
    setIsTranslatingBody(true);
    try {
      const result = await translateContent(
        {
          content_type: "post",
          content_id: post.id,
          field: "body",
          target_language: i18n.language,
        },
        activeSession.accessToken,
      );
      setTranslatedBody(result.translated_text);
      setIsBodyTranslationVisible(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("翻译失败，请稍后重试。"),
      );
    } finally {
      setIsTranslatingBody(false);
    }
  }

  const handleCommentCountChange = useCallback((commentCount: number) => {
    setPost((currentPost) =>
      currentPost
        ? { ...currentPost, comment_count: commentCount }
        : currentPost,
    );
  }, []);

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

  const content = isEditing ? (
    <BlogEditForm
      title={title}
      body={body}
      textSubtleColor={colors.textSubtle}
      onBack={onBack}
      onChangeTitle={setTitle}
      onChangeBody={setBody}
      onSave={() => void saveEdit()}
      onCancel={() => setIsEditing(false)}
      styles={styles}
      t={t}
    />
  ) : (
    <>
      <BlogReadContent
        post={post}
        message={message}
        primaryTextColor={colors.primaryText}
        translatedBody={translatedBody}
        isBodyTranslationVisible={isBodyTranslationVisible}
        isTranslatingBody={isTranslatingBody}
        imageRatios={imageRatios}
        onBack={onBack}
        onOpenAuthor={onOpenAuthor}
        onOpenTag={onOpenTag}
        onPreviewImage={setPreviewImageUrl}
        onImageRatio={(imageUrl, ratio) =>
          setImageRatios((current) =>
            current[imageUrl] === ratio
              ? current
              : { ...current, [imageUrl]: ratio },
          )
        }
        onToggleBodyTranslation={() => void toggleBodyTranslation()}
        styles={styles}
        t={t}
      />
      <BlogImagePreviewModal
        imageUrl={previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
        styles={styles}
        t={t}
      />
    </>
  );

  const bottomAccessory = !isEditing ? (
    <BlogBottomActions
      isOwner={post.is_owner}
      isLiked={post.is_liked}
      isFavorited={post.is_favorited}
      likeCount={post.like_count}
      commentCount={post.comment_count}
      favoriteCount={post.favorite_count}
      onToggleLike={() => void toggleLike()}
      onToggleFavorite={() => void toggleFavorite()}
      styles={styles}
      colors={colors}
    />
  ) : null;

  return (
    <CommentSection
      postId={post.id}
      session={currentSession}
      focusCommentId={focusCommentId}
      headerComponent={content}
      bottomAccessory={bottomAccessory}
      bottomComposerEnabled={!isEditing}
      contentContainerStyle={styles.blogPageContent}
      onRequireAuth={onRequireAuth}
      onCommentCountChange={handleCommentCountChange}
    />
  );
}
