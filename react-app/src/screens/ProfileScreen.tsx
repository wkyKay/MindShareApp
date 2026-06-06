import { useCallback, useRef } from "react";
import { ScrollView, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { GuestProfileScreen } from "./profile/GuestProfileScreen";
import { LoggedInProfileScreen } from "./profile/LoggedInProfileScreen";
import { useAppStyles } from "../theme/ThemeProvider";

type ProfileScreenProps = {
  onOpenAuth: () => void;
  onOpenPost: (postId: number) => void;
  onEditPost: (postId: number) => void;
  onOpenAuthor: (authorId: number) => void;
  onOpenTag: (tag: string) => void;
  onOpenAnalytics: () => void;
};

export function ProfileScreen({
  onOpenAuth,
  onOpenPost,
  onEditPost,
  onOpenAuthor,
  onOpenTag,
  onOpenAnalytics,
}: ProfileScreenProps) {
  const styles = useAppStyles();
  const { t } = useTranslation();
  const session = useAuthStore((state) => state.session);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const refreshAuth = useAuthStore((state) => state.refresh);
  const hasLoaded = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (hasLoaded.current) return;
      hasLoaded.current = true;

      async function loadProfile() {
        if (isMounted) {
          await refreshAuth();
        }
      }

      void loadProfile();

      return () => {
        isMounted = false;
      };
    }, [refreshAuth]),
  );

  if (isAuthLoading) {
    return (
      <ScrollView contentContainerStyle={styles.pageContent}>
        <Text style={styles.pageTitle}>{t("我的主页")}</Text>
        <Text style={styles.profileBio}>{t("正在加载账号信息...")}</Text>
      </ScrollView>
    );
  }

  if (!session) {
    return <GuestProfileScreen onOpenAuth={onOpenAuth} />;
  }

  return (
    <LoggedInProfileScreen
      session={session}
      onOpenPost={onOpenPost}
      onEditPost={onEditPost}
      onOpenAuthor={onOpenAuthor}
      onOpenTag={onOpenTag}
      onOpenAnalytics={onOpenAnalytics}
    />
  );
}
