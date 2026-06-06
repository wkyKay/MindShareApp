import type { AppColors } from "../../theme/colors";

export function createAuthStyles(colors: AppColors) {
  return {
    authHero: {
      backgroundColor: colors.text,
      borderRadius: 28,
      marginBottom: 18,
      padding: 22,
    },
    authEyebrow: {
      color: "#ffd7df",
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 1,
    },
    authTitle: {
      color: colors.surface,
      fontSize: 30,
      fontWeight: "900",
      marginTop: 12,
    },
    authSubtitle: {
      color: "#f2d8d0",
      fontSize: 15,
      lineHeight: 22,
      marginTop: 10,
    },
    authCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      padding: 18,
    },
    captchaRow: {
      alignItems: "stretch",
      flexDirection: "row",
      gap: 12,
      marginTop: 16,
    },
    captchaInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.text,
      flex: 1,
      fontSize: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    captchaImage: {
      alignItems: "center",
      backgroundColor: colors.surfaceSoft,
      borderColor: colors.borderStrong,
      borderRadius: 16,
      borderWidth: 1,
      justifyContent: "center",
      paddingHorizontal: 16,
      minWidth: 118,
    },
    captchaCode: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: 3,
    },
    captchaHint: {
      color: colors.primaryText,
      fontSize: 12,
      marginTop: 4,
    },
    authApiHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 14,
      textAlign: "center",
    },
    authPromptCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      marginTop: 24,
      padding: 20,
    },
    authPromptTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
    authPromptText: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 10,
    },
  } as const;
}
