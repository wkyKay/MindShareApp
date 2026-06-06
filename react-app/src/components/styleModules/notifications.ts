export const notificationsStyles = {
  notificationCard: {
    backgroundColor: "#fff8fb",
    borderColor: "#efc6d2",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  notificationCardRead: {
    backgroundColor: "#f1efee",
    borderColor: "#d8d2cf",
  },
  notificationTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  notificationTitle: {
    color: "#2f2320",
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  notificationMeta: {
    color: "#a05d6f",
    fontSize: 12,
    marginTop: 8,
  },
  notificationMetaRead: {
    color: "#8d8580",
  },
} as const;
