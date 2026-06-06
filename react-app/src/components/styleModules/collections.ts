export const collectionsStyles = {
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
    backgroundColor: "#fff7f3",
    borderColor: "#f0d7cf",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  compactDangerButton: {
    backgroundColor: "#fff0f2",
    borderColor: "#e4a3ad",
  },
  compactActionText: {
    color: "#a05d6f",
    fontSize: 12,
    fontWeight: "800",
  },
  compactDangerText: {
    color: "#7b2c3a",
  },
  movePostPanel: {
    backgroundColor: "#fffaf6",
    borderColor: "#f1c8b6",
    borderRadius: 16,
    borderStyle: "dashed",
    borderWidth: 1,
    marginBottom: 14,
    marginTop: -6,
    padding: 12,
  },
  movePostPanelOpen: {
    backgroundColor: "#fff4ec",
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
