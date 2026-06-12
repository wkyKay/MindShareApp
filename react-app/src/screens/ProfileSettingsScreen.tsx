import { ScrollView, Text } from "react-native";
import { useTranslation } from "react-i18next";

import type { AuthSession } from "../services/authSession";
import { useAuthStore } from "../stores/authStore";
import { useAppTheme } from "../theme/ThemeProvider";
import { LanguageSettingsCard } from "./profile/settings/LanguageSettingsCard";
import { ProfileAccountForm } from "./profile/settings/ProfileAccountForm";
import { ProfileBackgroundCard } from "./profile/settings/ProfileBackgroundCard";
import { ProfileSettingsGuestView } from "./profile/settings/ProfileSettingsGuestView";
import { ProfileSettingsHeader } from "./profile/settings/ProfileSettingsHeader";
import { SaveProfileButton } from "./profile/settings/SaveProfileButton";
import { ThemeSettingsCard } from "./profile/settings/ThemeSettingsCard";
import { useProfilePreferences } from "./profile/settings/hooks/useProfilePreferences";
import { useProfileSettingsForm } from "./profile/settings/hooks/useProfileSettingsForm";

type ProfileSettingsScreenProps = {
  session: AuthSession | null;
  onBack: () => void;
  onRequireAuth: () => void;
};

export function ProfileSettingsScreen({
  session,
  onBack,
  onRequireAuth,
}: ProfileSettingsScreenProps) {
  const { mode, setMode, styles } = useAppTheme();
  const { i18n, t } = useTranslation();
  const storeSession = useAuthStore((state) => state.session);
  const requireAuthSession = useAuthStore((state) => state.requireSession);
  const setAuthSession = useAuthStore((state) => state.setSession);
  const currentSession = storeSession ?? session;
  const form = useProfileSettingsForm({
    currentSession,
    requireAuthSession,
    setAuthSession,
    onRequireAuth,
  });
  const { selectLanguage, selectThemeMode } = useProfilePreferences({ setMode });

  if (!currentSession) {
    return (
      <ProfileSettingsGuestView
        onBack={onBack}
        onRequireAuth={onRequireAuth}
        styles={styles}
        t={t}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.pageContent}>
      <ProfileSettingsHeader onBack={onBack} styles={styles} t={t} />
      <Text style={styles.profileBio}>{t("修改账号资料、密码和个人主页背景图。")}</Text>

      <ProfileBackgroundCard
        backgroundUrl={form.backgroundUrl}
        onPickBackground={() => void form.pickBackground()}
        styles={styles}
        t={t}
      />

      <ProfileAccountForm
        username={form.username}
        email={form.email}
        displayName={form.displayName}
        bio={form.bio}
        password={form.password}
        onChangeUsername={form.setUsername}
        onChangeEmail={form.setEmail}
        onChangeDisplayName={form.setDisplayName}
        onChangeBio={form.setBio}
        onChangePassword={form.setPassword}
        styles={styles}
        t={t}
      />

      <LanguageSettingsCard
        language={i18n.language}
        onSelectLanguage={(language) => void selectLanguage(language)}
        styles={styles}
        t={t}
      />

      <ThemeSettingsCard
        mode={mode}
        onSelectThemeMode={(themeMode) => void selectThemeMode(themeMode)}
        styles={styles}
        t={t}
      />

      <SaveProfileButton
        isSubmitting={form.isSubmitting}
        onSubmit={() => void form.submitProfile()}
        styles={styles}
        t={t}
      />
      {form.message ? <Text style={styles.authApiHint}>{form.message}</Text> : null}
    </ScrollView>
  );
}
