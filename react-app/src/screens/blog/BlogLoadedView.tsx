import { useMemo } from "react";

import { CommentSection } from "../../components/CommentSection";
import type { AuthSession } from "../../services/authSession";
import type { PostDetail } from "../../services/postApi";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "../../theme/ThemeProvider";
import { BlogBottomActions } from "./BlogBottomActions";
import { BlogEditForm } from "./BlogEditForm";
import { BlogImagePreviewModal } from "./BlogImagePreviewModal";
import { BlogReadContent } from "./BlogReadContent";

type BlogLoadedViewProps = {
  post: PostDetail;
  session: AuthSession | null;
  focusCommentId?: number;
  isEditing: boolean;
  title: string;
  body: string;
  message: string;
  translatedBody: string | null;
  isBodyTranslationVisible: boolean;
  isTranslatingBody: boolean;
  imageRatios: Record<string, number>;
  previewImageUrl: string | null;
  onBack: () => void;
  onOpenAuthor: (authorId: number) => void;
  onOpenTag: (tag: string) => void;
  onRequireAuth: () => void;
  onChangeTitle: (title: string) => void;
  onChangeBody: (body: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onPreviewImage: (imageUrl: string | null) => void;
  onImageRatio: (imageUrl: string, ratio: number) => void;
  onToggleBodyTranslation: () => void;
  onToggleLike: () => void;
  onToggleFavorite: () => void;
  onCommentCountChange: (commentCount: number) => void;
};

export function BlogLoadedView({
  post,
  session,
  focusCommentId,
  isEditing,
  title,
  body,
  message,
  translatedBody,
  isBodyTranslationVisible,
  isTranslatingBody,
  imageRatios,
  previewImageUrl,
  onBack,
  onOpenAuthor,
  onOpenTag,
  onRequireAuth,
  onChangeTitle,
  onChangeBody,
  onCancelEdit,
  onSaveEdit,
  onPreviewImage,
  onImageRatio,
  onToggleBodyTranslation,
  onToggleLike,
  onToggleFavorite,
  onCommentCountChange,
}: BlogLoadedViewProps) {
  const { colors, styles } = useAppTheme();
  const { t } = useTranslation();

  const headerComponent = useMemo(
    () =>
      isEditing ? (
        <BlogEditForm
          title={title}
          body={body}
          textSubtleColor={colors.textSubtle}
          onBack={onBack}
          onChangeTitle={onChangeTitle}
          onChangeBody={onChangeBody}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
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
            onPreviewImage={onPreviewImage}
            onImageRatio={onImageRatio}
            onToggleBodyTranslation={onToggleBodyTranslation}
            styles={styles}
            t={t}
          />
          <BlogImagePreviewModal
            imageUrl={previewImageUrl}
            onClose={() => onPreviewImage(null)}
            styles={styles}
            t={t}
          />
        </>
      ),
    [
      body,
      colors.primaryText,
      colors.textSubtle,
      imageRatios,
      isBodyTranslationVisible,
      isEditing,
      isTranslatingBody,
      message,
      onBack,
      onCancelEdit,
      onChangeBody,
      onChangeTitle,
      onImageRatio,
      onOpenAuthor,
      onOpenTag,
      onPreviewImage,
      onSaveEdit,
      onToggleBodyTranslation,
      post,
      previewImageUrl,
      styles,
      t,
      title,
      translatedBody,
    ],
  );

  const bottomAccessory = useMemo(
    () =>
      !isEditing ? (
        <BlogBottomActions
          isOwner={post.is_owner}
          isLiked={post.is_liked}
          isFavorited={post.is_favorited}
          likeCount={post.like_count}
          commentCount={post.comment_count}
          favoriteCount={post.favorite_count}
          onToggleLike={onToggleLike}
          onToggleFavorite={onToggleFavorite}
          styles={styles}
          colors={colors}
        />
      ) : null,
    [colors, isEditing, onToggleFavorite, onToggleLike, post, styles],
  );

  return (
    <CommentSection
      postId={post.id}
      session={session}
      focusCommentId={focusCommentId}
      headerComponent={headerComponent}
      bottomAccessory={bottomAccessory}
      bottomComposerEnabled={!isEditing}
      contentContainerStyle={styles.blogPageContent}
      onRequireAuth={onRequireAuth}
      onCommentCountChange={onCommentCountChange}
    />
  );
}
