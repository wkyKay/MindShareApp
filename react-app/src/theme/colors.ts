export type AppThemeMode = "light" | "dark" | "system";
export type ResolvedThemeMode = "light" | "dark";

export type AppColors = Record<
  | "background"
  | "surface"
  | "surfaceSoft"
  | "surfaceWarm"
  | "surfacePink"
  | "surfacePinkStrong"
  | "text"
  | "textMuted"
  | "textSubtle"
  | "border"
  | "borderStrong"
  | "primary"
  | "primaryText"
  | "danger"
  | "dangerText"
  | "warning"
  | "warningBorder"
  | "warningText"
  | "overlay"
  | "imageOverlay"
  | "white",
  string
>;

export const lightColors: AppColors = {
  background: "#f5f5f5",
  surface: "#ffffff",
  surfaceSoft: "#fff7f3",
  surfaceWarm: "#fffaf6",
  surfacePink: "#fff0f4",
  surfacePinkStrong: "#ffe1e8",
  text: "#2f2320",
  textMuted: "#806f69",
  textSubtle: "#8d7b75",
  border: "#f0d7cf",
  borderStrong: "#e9bfc4",
  primary: "#d94f70",
  primaryText: "#a05d6f",
  danger: "#e84040",
  dangerText: "#7b2c3a",
  warning: "#fff1b8",
  warningBorder: "#e1b84c",
  warningText: "#7a5814",
  overlay: "rgba(47, 35, 32, 0.42)",
  imageOverlay: "rgba(47, 35, 32, 0.92)",
  white: "#ffffff",
};

export const darkColors: AppColors = {
  background: "#111111",
  surface: "#1c1c1e",
  surfaceSoft: "#242326",
  surfaceWarm: "#211f1f",
  surfacePink: "#2b1d24",
  surfacePinkStrong: "#3a2430",
  text: "#f5f5f5",
  textMuted: "#c2b8b4",
  textSubtle: "#a89c98",
  border: "#343034",
  borderStrong: "#4b3840",
  primary: "#ff6f91",
  primaryText: "#ff9db5",
  danger: "#ff5a5a",
  dangerText: "#ffb0b0",
  warning: "#3a321a",
  warningBorder: "#8b6b21",
  warningText: "#ffd36a",
  overlay: "rgba(0, 0, 0, 0.62)",
  imageOverlay: "rgba(0, 0, 0, 0.94)",
  white: "#ffffff",
};

export function colorsForTheme(theme: ResolvedThemeMode) {
  return theme === "dark" ? darkColors : lightColors;
}
