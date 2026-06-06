import type { AppColors } from "../../theme/colors";

export function createBlogStyles(colors: AppColors) {
  return {
    commentNotificationHint: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 12,
    },
    translationInlineAction: {
      alignSelf: "flex-start",
      marginTop: 6,
      paddingVertical: 2,
    },
    translationInlineText: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: "700",
    },
    blogImage: {
      alignSelf: "center",
      backgroundColor: colors.surfaceSoft,
      borderRadius: 18,
      maxHeight: 420,
      width: "100%",
    },
    imagePreviewOverlay: {
      alignItems: "center",
      backgroundColor: colors.imageOverlay,
      flex: 1,
      justifyContent: "center",
      padding: 18,
    },
    imagePreview: {
      height: "82%",
      width: "100%",
    },
    imagePreviewHint: {
      color: colors.surfaceSoft,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 12,
    },
    commentSection: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      marginTop: 28,
      paddingTop: 4,
    },
    commentScreenContainer: {
      backgroundColor: colors.surface,
      flex: 1,
    },
    commentList: {
      backgroundColor: colors.surface,
      flex: 1,
    },
    blogBottomBarHost: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      paddingBottom: 10,
      paddingHorizontal: 14,
      paddingTop: 10,
    },
    blogBottomBar: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
    },
    blogReplyTargetRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    blogReplyTargetText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
    },
    blogReplyCancelText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "900",
    },
    blogBottomCommentInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      color: colors.text,
      flex: 1,
      fontSize: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    blogBottomActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    blogBottomActionButton: {
      alignItems: "center",
      minWidth: 34,
    },
    blogBottomActionText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      marginTop: 2,
    },
    commentCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      marginTop: 12,
      padding: 14,
    },
    commentThread: {
      marginTop: 12,
    },
    commentReplyThread: {
      marginLeft: 18,
    },
    commentReplyCard: {
      backgroundColor: colors.surfaceSoft,
    },
    commentFocusedCard: {
      backgroundColor: colors.surfacePink,
      borderColor: colors.primary,
    },
    commentHeader: {
      alignItems: "baseline",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "space-between",
    },
    commentBody: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 10,
    },
  } as const;
}
