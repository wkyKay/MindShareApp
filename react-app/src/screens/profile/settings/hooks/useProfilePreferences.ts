import { changeAppLanguage, type SupportedLanguage } from "../../../../i18n";
import type { AppThemeMode } from "../../../../theme/colors";

type UseProfilePreferencesOptions = {
  setMode: (mode: AppThemeMode) => Promise<void>;
};

export function useProfilePreferences({ setMode }: UseProfilePreferencesOptions) {
  async function selectLanguage(language: SupportedLanguage) {
    await changeAppLanguage(language);
  }

  async function selectThemeMode(themeMode: AppThemeMode) {
    await setMode(themeMode);
  }

  return {
    selectLanguage,
    selectThemeMode,
  };
}
