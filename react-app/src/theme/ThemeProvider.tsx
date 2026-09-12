import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { fetchUserTheme } from "../services/themeApi";
import { useAuthStore } from "../stores/authStore";

export const THEME_STORAGE_KEY = "app.themeMode";
export const CUSTOM_LIGHT_THEME_KEY = "app.customLightTheme";
export const CUSTOM_DARK_THEME_KEY = "app.customDarkTheme";

export type PartialThemeColors = Partial<AppColors>;

type AppThemeContextValue = {
  colors: AppColors;
  mode: AppThemeMode;
  resolvedMode: ResolvedThemeMode;
  styles: AppStyles;
  /** 切换主题模式（light / dark / system） */
  setMode: (mode: AppThemeMode) => Promise<void>;
  /** 用户已保存的自定义主题（增量形式） */
  customLightTheme: PartialThemeColors | null;
  customDarkTheme: PartialThemeColors | null;
  /** 当前正在预览的临时主题（增量形式） */
  previewTheme: PartialThemeColors | null;
  /** 设置预览主题（即时生效，不持久化） */
  applyPreviewTheme: (theme: PartialThemeColors) => void;
  /** 确认预览主题：将预览主题合并保存到当前激活模式的自定义主题 */
  confirmPreviewTheme: () => Promise<void>;
  /** 取消预览，恢复到已保存的自定义主题 */
  cancelPreviewTheme: () => void;
  /** 直接设置某模式的自定义主题（用于 API 返回后更新本地状态） */
  setCustomTheme: (
    theme: PartialThemeColors | null,
    mode: "light" | "dark",
  ) => Promise<void>;
  /** 重置某模式（或全部）的自定义主题 */
  resetCustomTheme: (mode: "light" | "dark" | "all") => Promise<void>;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

/** 将增量主题合并到基础色板，得到完整 AppColors */
function mergeTheme(
  base: AppColors,
  ...overrides: Array<PartialThemeColors | null | undefined>
): AppColors {
  const result = { ...base };
  for (const override of overrides) {
    if (!override) continue;
    for (const key of Object.keys(override) as Array<keyof AppColors>) {
      const value = override[key];
      if (value) {
        result[key] = value;
      }
    }
  }
  return result;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<AppThemeMode>("system");
  const [customLightTheme, setCustomLightTheme] =
    useState<PartialThemeColors | null>(null);
  const [customDarkTheme, setCustomDarkTheme] =
    useState<PartialThemeColors | null>(null);
  const [previewTheme, setPreviewTheme] = useState<PartialThemeColors | null>(
    null,
  );
  const session = useAuthStore((state) => state.session);
  const serverThemeAppliedRef = useRef(false);

  // 初始化：从 AsyncStorage 读取主题模式和自定义主题
  useEffect(() => {
    void (async () => {
      const [storedMode, storedLight, storedDark] = await Promise.all([
        AsyncStorage.getItem(THEME_STORAGE_KEY),
        AsyncStorage.getItem(CUSTOM_LIGHT_THEME_KEY),
        AsyncStorage.getItem(CUSTOM_DARK_THEME_KEY),
      ]);
      if (
        storedMode === "light" ||
        storedMode === "dark" ||
        storedMode === "system"
      ) {
        setModeState(storedMode);
      }
      // 登录后以服务器返回的主题为准，已从服务器应用过则忽略本地缓存
      if (serverThemeAppliedRef.current) return;
      if (storedLight) {
        try {
          setCustomLightTheme(JSON.parse(storedLight) as PartialThemeColors);
        } catch {
          // ignore
        }
      }
      if (storedDark) {
        try {
          setCustomDarkTheme(JSON.parse(storedDark) as PartialThemeColors);
        } catch {
          // ignore
        }
      }
    })();
  }, []);

  const resolvedMode: ResolvedThemeMode =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  // 计算最终颜色：默认色板 + 自定义主题 + 预览主题
  const colors = useMemo(() => {
    const base = colorsForTheme(resolvedMode);
    const custom =
      resolvedMode === "light" ? customLightTheme : customDarkTheme;
    return mergeTheme(base, custom, previewTheme);
  }, [resolvedMode, customLightTheme, customDarkTheme, previewTheme]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const setMode = useCallback(async (nextMode: AppThemeMode) => {
    setModeState(nextMode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
  }, []);

  const applyPreviewTheme = useCallback((theme: PartialThemeColors) => {
    setPreviewTheme(theme);
  }, []);

  const cancelPreviewTheme = useCallback(() => {
    setPreviewTheme(null);
  }, []);

  const confirmPreviewTheme = useCallback(async () => {
    if (!previewTheme) return;
    // 将预览主题合并到当前激活模式的自定义主题
    if (resolvedMode === "light") {
      const merged = { ...(customLightTheme ?? {}), ...previewTheme };
      setCustomLightTheme(merged);
      await AsyncStorage.setItem(
        CUSTOM_LIGHT_THEME_KEY,
        JSON.stringify(merged),
      );
    } else {
      const merged = { ...(customDarkTheme ?? {}), ...previewTheme };
      setCustomDarkTheme(merged);
      await AsyncStorage.setItem(
        CUSTOM_DARK_THEME_KEY,
        JSON.stringify(merged),
      );
    }
    setPreviewTheme(null);
  }, [previewTheme, resolvedMode, customLightTheme, customDarkTheme]);

  const setCustomTheme = useCallback(
    async (theme: PartialThemeColors | null, mode: "light" | "dark") => {
      if (mode === "light") {
        setCustomLightTheme(theme);
        if (theme) {
          await AsyncStorage.setItem(
            CUSTOM_LIGHT_THEME_KEY,
            JSON.stringify(theme),
          );
        } else {
          await AsyncStorage.removeItem(CUSTOM_LIGHT_THEME_KEY);
        }
      } else {
        setCustomDarkTheme(theme);
        if (theme) {
          await AsyncStorage.setItem(
            CUSTOM_DARK_THEME_KEY,
            JSON.stringify(theme),
          );
        } else {
          await AsyncStorage.removeItem(CUSTOM_DARK_THEME_KEY);
        }
      }
    },
    [],
  );

  const resetCustomTheme = useCallback(
    async (mode: "light" | "dark" | "all") => {
      if (mode === "light" || mode === "all") {
        setCustomLightTheme(null);
        await AsyncStorage.removeItem(CUSTOM_LIGHT_THEME_KEY);
      }
      if (mode === "dark" || mode === "all") {
        setCustomDarkTheme(null);
        await AsyncStorage.removeItem(CUSTOM_DARK_THEME_KEY);
      }
      setPreviewTheme(null);
    },
    [],
  );

  // 登录后必须重新从服务器拉取主题：有数据则应用，无数据则维持默认。
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!session) {
        serverThemeAppliedRef.current = false;
        await resetCustomTheme("all");
        return;
      }
      try {
        const theme = await fetchUserTheme(session.accessToken);
        if (cancelled) return;
        serverThemeAppliedRef.current = true;
        await setCustomTheme(theme.light, "light");
        await setCustomTheme(theme.dark, "dark");
      } catch {
        // 拉取失败时保留本地缓存，避免网络异常清空用户主题
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, setCustomTheme, resetCustomTheme]);

  const value: AppThemeContextValue = {
    colors,
    mode,
    resolvedMode,
    styles,
    setMode,
    customLightTheme,
    customDarkTheme,
    previewTheme,
    applyPreviewTheme,
    confirmPreviewTheme,
    cancelPreviewTheme,
    setCustomTheme,
    resetCustomTheme,
  };

  return (
    <AppThemeContext.Provider value={value}>
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
