import { StyleSheet } from "react-native";

import { lightColors, type AppColors } from "../theme/colors";
import { createAuthStyles } from "./styleModules/auth";
import { createBlogStyles } from "./styleModules/blog";
import { createCardsStyles } from "./styleModules/cards";
import { createCollectionsStyles } from "./styleModules/collections";
import { createCommonStyles } from "./styleModules/common";
import { createHomeStyles } from "./styleModules/home";
import { createLayoutStyles } from "./styleModules/layout";
import { createMessagesStyles } from "./styleModules/messages";
import { createModalsStyles } from "./styleModules/modals";
import { createNotificationsStyles } from "./styleModules/notifications";
import { createProfileStyles } from "./styleModules/profile";
import { createSkeletonStyles } from "./styleModules/skeleton";
import { createUploadStyles } from "./styleModules/upload";

export function createStyles(colors: AppColors) {
  return StyleSheet.create({
    ...createAuthStyles(colors),
    ...createBlogStyles(colors),
    ...createCardsStyles(colors),
    ...createCollectionsStyles(colors),
    ...createCommonStyles(colors),
    ...createHomeStyles(colors),
    ...createLayoutStyles(colors),
    ...createMessagesStyles(colors),
    ...createModalsStyles(colors),
    ...createNotificationsStyles(colors),
    ...createProfileStyles(colors),
    ...createSkeletonStyles(colors),
    ...createUploadStyles(colors),
  });
}

export type AppStyles = ReturnType<typeof createStyles>;

export const styles = createStyles(lightColors);

export type MarkdownStyle = {
  body?: object;
};

export const markdownStyles = {
  body: {
    color: "#2f2320",
    fontSize: 16,
    lineHeight: 26,
    marginTop: 20,
  },
} as const;
