import { StyleSheet } from "react-native";

import { authStyles } from "./styleModules/auth";
import { blogStyles } from "./styleModules/blog";
import { cardsStyles } from "./styleModules/cards";
import { collectionsStyles } from "./styleModules/collections";
import { commonStyles } from "./styleModules/common";
import { homeStyles } from "./styleModules/home";
import { layoutStyles } from "./styleModules/layout";
import { messagesStyles } from "./styleModules/messages";
import { modalsStyles } from "./styleModules/modals";
import { notificationsStyles } from "./styleModules/notifications";
import { profileStyles } from "./styleModules/profile";
import { skeletonStyles } from "./styleModules/skeleton";
import { uploadStyles } from "./styleModules/upload";

export const styles = StyleSheet.create({
  ...authStyles,
  ...blogStyles,
  ...cardsStyles,
  ...collectionsStyles,
  ...commonStyles,
  ...homeStyles,
  ...layoutStyles,
  ...messagesStyles,
  ...modalsStyles,
  ...notificationsStyles,
  ...profileStyles,
  ...skeletonStyles,
  ...uploadStyles,
});

export type MarkdownStyle = {
  body?: object;
};

export const markdownStyles = {
  body: {
    color: "#3d302c",
    fontSize: 16,
    lineHeight: 26,
    marginTop: 20,
  },
} as const;
