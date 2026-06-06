export const skeletonStyles = {
  skeletonBlock: {
    backgroundColor: "#f0d7cf",
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
    backgroundColor: "#f0d7cf",
    borderRadius: 18,
    marginBottom: 20,
    marginTop: 18,
    width: "100%",
  },
} as const;
