// Тема, яку людина обрала перемикачем (src/components/ui/theme-toggle.tsx); без cookie — за системою.
export const THEME_COOKIE = "theme";

export type Theme = "light" | "dark";

export function parseTheme(value: string | undefined): Theme | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}
