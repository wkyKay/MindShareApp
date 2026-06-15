import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { LazyImage } from "../../components/LazyImage";
import type { AppStyles } from "../../components/styles";
import type { AuthSession } from "../../services/authSession";
import type { ProfileCollection } from "../../services/profileApi";
import { ProfileStats, type ProfileTab } from "./ProfileStats";

type ProfileListHeaderProps = {
  user: AuthSession["user"];
  activeTab: ProfileTab;
  postsCount: number;
  favoritesCount: number;
  collectionsCount: number;
  followingCount: number;
  postsBadgeCount: number;
  selectedCollection: ProfileCollection | null;
  sectionTitle: string;
  collectionForm: ReactNode;
  profileHeaderContent: ReactNode;
  onLogout: () => void;
  onSelectTab: (tab: ProfileTab) => void;
  onBackFromCollection: () => void;
  styles: AppStyles;
  t: (key: string) => string;
};

export function ProfileListHeader({
  user,
  activeTab,
  postsCount,
  favoritesCount,
  collectionsCount,
  followingCount,
  postsBadgeCount,
  selectedCollection,
  sectionTitle,
  collectionForm,
  profileHeaderContent,
  onLogout,
  onSelectTab,
  onBackFromCollection,
  styles,
  t,
}: ProfileListHeaderProps) {
  return (
    <>
      {user.background_url ? (
        <View style={styles.profileHeaderWithBackground}>
          <LazyImage
            uri={user.background_url}
            style={styles.profileHeaderBackgroundImage}
          />
          <View style={styles.profileHeaderOverlay}>{profileHeaderContent}</View>
        </View>
      ) : (
        profileHeaderContent
      )}

      <Pressable style={styles.backButton} onPress={onLogout}>
        <Text style={styles.backButtonText}>{t("退出登录")}</Text>
      </Pressable>

      <ProfileStats
        activeTab={activeTab}
        postsCount={postsCount}
        favoritesCount={favoritesCount}
        collectionsCount={collectionsCount}
        followingCount={followingCount}
        postsBadgeCount={postsBadgeCount}
        onSelectTab={onSelectTab}
      />

      {selectedCollection ? (
        <Pressable style={styles.backButton} onPress={onBackFromCollection}>
          <Text style={styles.backButtonText}>{t("‹ 返回合集")}</Text>
        </Pressable>
      ) : null}
      {selectedCollection?.description ? (
        <Text style={styles.profileBio}>{selectedCollection.description}</Text>
      ) : null}
      {collectionForm}
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
    </>
  );
}
