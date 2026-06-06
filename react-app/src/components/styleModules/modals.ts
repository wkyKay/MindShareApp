export const modalsStyles = {
  confirmOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(47, 35, 32, 0.42)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  confirmDialog: {
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    maxWidth: 420,
    padding: 20,
    width: "100%",
  },
  confirmTitle: {
    color: "#2f2320",
    fontSize: 20,
    fontWeight: "900",
  },
  confirmMessage: {
    color: "#806f69",
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
    backgroundColor: "#f1efee",
  },
  confirmDangerButton: {
    backgroundColor: "#e84040",
  },
  confirmCancelText: {
    color: "#5d4e49",
    fontWeight: "900",
  },
  confirmDangerText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  languageOptionList: {
    gap: 10,
    marginTop: 18,
  },
  languageOptionButton: {
    alignItems: "center",
    backgroundColor: "#f7f3f1",
    borderColor: "#e5d8d2",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
  },
  languageOptionButtonActive: {
    backgroundColor: "#ffe1e8",
    borderColor: "#d94f70",
  },
  languageOptionText: {
    color: "#5d4e49",
    fontSize: 15,
    fontWeight: "800",
  },
  languageOptionTextActive: {
    color: "#a05d6f",
  },
} as const;
