import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enUS from "./locales/en-US.json";
import zhCN from "./locales/zh-CN.json";

export const LANGUAGE_STORAGE_KEY = "app.language";
export const supportedLanguages = ["zh-CN", "en-US"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

function normalizeLanguage(languageTag?: string | null): SupportedLanguage {
  if (languageTag?.toLowerCase().startsWith("en")) {
    return "en-US";
  }
  return "zh-CN";
}

i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  fallbackLng: "zh-CN",
  keySeparator: false,
  interpolation: {
    escapeValue: false,
  },
  lng: normalizeLanguage(Localization.getLocales()[0]?.languageTag),
  resources: {
    "en-US": { translation: enUS },
    "zh-CN": { translation: zhCN },
  },
});

void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((storedLanguage) => {
  if (supportedLanguages.includes(storedLanguage as SupportedLanguage)) {
    void i18n.changeLanguage(storedLanguage as SupportedLanguage);
  }
});

export async function changeAppLanguage(language: SupportedLanguage) {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(language);
}

export default i18n;
