import type { AppColors } from "../../theme/colors";

export function createHomeStyles(colors: AppColors) {
  return {
    searchInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    suggestionPanel: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      marginTop: 10,
      overflow: "hidden",
    },
    suggestionItem: {
      borderBottomColor: colors.surfaceSoft,
      borderBottomWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    suggestionSectionTitle: {
      color: colors.textSubtle,
      fontSize: 12,
      fontWeight: "900",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    suggestionText: {
      color: colors.primaryText,
      fontWeight: "800",
    },
    suggestionMeta: {
      color: colors.textSubtle,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
    },
    suggestionEmptyText: {
      color: colors.textSubtle,
      fontSize: 13,
      padding: 16,
    },
    selectedTagRow: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    selectedTagText: {
      color: colors.primary,
      fontSize: 17,
      fontWeight: "900",
    },
    segmentedControl: {
      flexDirection: "row",
      gap: 28,
      justifyContent: "center",
      paddingHorizontal: 72,
      paddingTop: 14,
      paddingBottom: 4,
    },
    segmentButton: {
      alignItems: "center",
      flex: 1,
      paddingVertical: 8,
    },
    segmentButtonActive: {},
    segmentText: {
      color: colors.textSubtle,
      fontSize: 17,
      fontWeight: "800",
    },
    segmentTextActive: {
      color: "#1f1f1f",
    },
    segmentUnderline: {
      backgroundColor: "transparent",
      borderRadius: 999,
      height: 3,
      marginTop: 7,
      width: 24,
    },
    segmentUnderlineActive: {
      backgroundColor: "#1f1f1f",
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 12,
      marginTop: 24,
    },
    sectionTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
  } as const;
}
