import type { AppColors } from "../../theme/colors";

export function createModalsStyles(colors: AppColors) {
  return {
    confirmOverlay: {
      alignItems: "center",
      backgroundColor: colors.overlay,
      flex: 1,
      justifyContent: "center",
      padding: 24,
    },
    confirmDialog: {
      alignSelf: "center",
      backgroundColor: colors.surface,
      borderRadius: 24,
      maxWidth: 420,
      padding: 20,
      width: "100%",
    },
    confirmTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
    },
    confirmMessage: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 10,
    },
    confirmActionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 18,
    },
    confirmButton: {
      alignItems: "center",
      borderRadius: 16,
      flex: 1,
      paddingVertical: 13,
    },
    confirmCancelButton: {
      backgroundColor: colors.surfaceSoft,
    },
    confirmDangerButton: {
      backgroundColor: colors.danger,
    },
    confirmCancelText: {
      color: colors.textMuted,
      fontWeight: "900",
    },
    confirmDangerText: {
      color: colors.surface,
      fontWeight: "900",
    },
    languageOptionList: {
      gap: 10,
      marginTop: 18,
    },
    languageOptionButton: {
      alignItems: "center",
      backgroundColor: "#f7f3f1",
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      paddingVertical: 14,
    },
    languageOptionButtonActive: {
      backgroundColor: colors.surfacePinkStrong,
      borderColor: colors.primary,
    },
    languageOptionText: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: "800",
    },
    languageOptionTextActive: {
      color: colors.primaryText,
    },
  } as const;
}
