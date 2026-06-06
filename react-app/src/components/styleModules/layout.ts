import type { AppColors } from "../../theme/colors";

export function createLayoutStyles(colors: AppColors) {
  return {
    gestureRoot: {
      flex: 1,
    },
    shell: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 40,
    },
    app: {
      flex: 1,
      width: "100%",
      maxWidth: 720,
      alignSelf: "center",
      backgroundColor: colors.background,
    },
    pageContent: {
      backgroundColor: colors.background,
      padding: 20,
      paddingBottom: 24,
    },
    blogPageContent: {
      backgroundColor: colors.surface,
    },
    homeScreen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    authPageContent: {
      backgroundColor: colors.background,
      padding: 20,
      paddingBottom: 24,
      paddingTop: 28,
    },
  } as const;
}
