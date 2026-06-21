import type { AppColors } from "../../theme/colors";

export function createCardsStyles(colors: AppColors) {
  return {
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      marginBottom: 14,
      padding: 16,
    },
    cardPressed: {
      opacity: 0.82,
      transform: [{ scale: 0.99 }],
    },
    cardCover: {
      backgroundColor: colors.surfaceSoft,
      borderRadius: 14,
      height: 120,
      marginBottom: 12,
      width: "100%",
    },
    postCardActionMenuRow: {
      alignSelf: "flex-end",
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 8,
      padding: 4,
    },
    postCardActionButton: {
      backgroundColor: colors.surfacePink,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    postCardActionButtonMuted: {
      backgroundColor: colors.surfaceSoft,
    },
    postCardActionText: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: "900",
    },
    postCardDeleteButton: {
      backgroundColor: colors.danger,
    },
    postCardDeleteText: {
      color: colors.surface,
      fontSize: 12,
      fontWeight: "900",
    },
    draftCard: {
      backgroundColor: colors.warning,
      borderColor: colors.warningBorder,
    },
    deletedCard: {
      backgroundColor: colors.surfaceSoft,
      borderColor: colors.border,
      opacity: 0.72,
    },
    draftBadge: {
      alignSelf: "flex-start",
      backgroundColor: colors.warningBorder,
      borderRadius: 999,
      color: colors.warningText,
      fontSize: 12,
      fontWeight: "900",
      marginBottom: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    deletedBadge: {
      alignSelf: "flex-start",
      backgroundColor: colors.textSubtle,
      borderRadius: 999,
      color: colors.surface,
      fontSize: 12,
      fontWeight: "900",
      marginBottom: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    cardTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    cardNotificationDot: {
      backgroundColor: colors.primary,
      borderRadius: 5,
      height: 10,
      width: 10,
    },
    deletedText: {
      color: colors.textSubtle,
    },
    cardMeta: {
      color: colors.textSubtle,
      marginTop: 6,
    },
    cardAuthor: {
      color: colors.primaryText,
      marginTop: 6,
    },
    cardSummary: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 10,
    },
    cardMarkdownSummary: {
      marginTop: 10,
    },
    cardStats: {
      flexDirection: "row",
      gap: 14,
      marginTop: 14,
    },
    statText: {
      color: colors.primaryText,
      fontSize: 13,
    },
    tagList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 14,
    },
    tagChip: {
      backgroundColor: colors.surfacePinkStrong,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    tagChipText: {
      color: colors.primaryText,
      fontWeight: "700",
    },
  } as const;
}
