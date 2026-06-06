import type { AppColors } from "../../theme/colors";

export function createNotificationsStyles(colors: AppColors) {
  return {
    notificationCard: {
      backgroundColor: colors.surfacePink,
      borderColor: "#efc6d2",
      borderRadius: 18,
      borderWidth: 1,
      marginTop: 12,
      padding: 16,
    },
    notificationCardRead: {
      backgroundColor: colors.surfaceSoft,
      borderColor: colors.border,
    },
    notificationTitleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "space-between",
    },
    notificationTitle: {
      color: colors.text,
      flex: 1,
      fontSize: 16,
      fontWeight: "700",
    },
    notificationMeta: {
      color: colors.primaryText,
      fontSize: 12,
      marginTop: 8,
    },
    notificationMetaRead: {
      color: colors.textSubtle,
    },
  } as const;
}
