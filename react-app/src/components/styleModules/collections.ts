import type { AppColors } from "../../theme/colors";

export function createCollectionsStyles(colors: AppColors) {
  return {
    collectionFavoriteCard: {
      backgroundColor: "#f4fbff",
      borderColor: "#94c8df",
    },
    collectionBadge: {
      alignSelf: "flex-start",
      backgroundColor: "#d9f0fb",
      borderRadius: 999,
      color: "#26708f",
      fontSize: 12,
      fontWeight: "900",
      marginBottom: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    compactActionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 14,
    },
    compactActionButton: {
      alignItems: "center",
      backgroundColor: colors.surfaceSoft,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    compactDangerButton: {
      backgroundColor: colors.surfacePink,
      borderColor: colors.borderStrong,
    },
    compactActionText: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: "800",
    },
    compactDangerText: {
      color: colors.dangerText,
    },
    movePostPanel: {
      backgroundColor: colors.surfaceWarm,
      borderColor: "#f1c8b6",
      borderRadius: 16,
      borderStyle: "dashed",
      borderWidth: 1,
      marginBottom: 14,
      marginTop: -6,
      padding: 12,
    },
    movePostPanelOpen: {
      backgroundColor: colors.surfaceSoft,
    },
    movePostTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    movePostTitle: {
      color: "#8d4b3c",
      fontSize: 13,
      fontWeight: "800",
    },
    movePostHint: {
      color: "#9b756b",
      fontSize: 12,
      lineHeight: 18,
    },
    movePostCollectionList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
  } as const;
}
