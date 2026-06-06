import type { AppColors } from "../../theme/colors";

export function createSkeletonStyles(colors: AppColors) {
  return {
    skeletonBlock: {
      backgroundColor: colors.border,
      borderRadius: 999,
    },
    skeletonGapSmall: {
      height: 8,
    },
    skeletonGapMedium: {
      height: 12,
    },
    skeletonGapLarge: {
      height: 22,
    },
    skeletonTagRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 16,
    },
    skeletonHero: {
      aspectRatio: 1.6,
      backgroundColor: colors.border,
      borderRadius: 18,
      marginBottom: 20,
      marginTop: 18,
      width: "100%",
    },
  } as const;
}
