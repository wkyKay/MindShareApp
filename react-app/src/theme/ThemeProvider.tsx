import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { createStyles, type AppStyles } from "../components/styles";
import {
  colorsForTheme,
  type AppColors,
  type AppThemeMode,
  type ResolvedThemeMode,
} from "./colors";

export const THEME_STORAGE_KEY = "app.themeMode";

type AppThemeContextValue = {
  colors: AppColors;
  mode: AppThemeMode;
  resolvedMode: ResolvedThemeMode;
  setMode: (mode: AppThemeMode) => Promise<void>;
  styles: AppStyles;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<AppThemeMode>("system");

  useEffect(() => {
    void AsyncStorage.getItem(THEME_STORAGE_KEY).then((storedMode) => {
      if (
        storedMode === "light" ||
        storedMode === "dark" ||
        storedMode === "system"
      ) {
        setModeState(storedMode);
      }
    });
  }, []);

  const resolvedMode: ResolvedThemeMode =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;
  const colors = useMemo(() => colorsForTheme(resolvedMode), [resolvedMode]);
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function setMode(nextMode: AppThemeMode) {
    setModeState(nextMode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
  }

  return (
    <AppThemeContext.Provider
      value={{ colors, mode, resolvedMode, setMode, styles }}
    >
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);
  if (!value) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return value;
}

export function useAppStyles() {
  return useAppTheme().styles;
}
