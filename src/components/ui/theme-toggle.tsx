"use client";

// Перемикач світлої й темної теми (DESIGN.md, розділ 2). Вибір — атрибут data-theme на <html> і cookie `theme`,
// щоб сервер одразу віддав сторінку в обраній темі (src/app/layout.tsx). Без вибору тема — за системою.
import { Moon, Sun } from "lucide-react";
import { THEME_COOKIE } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "./button";

function toggleTheme() {
  const root = document.documentElement;
  const current = root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

// Іконка — за поточною темою через варіант dark:, тож сервер і браузер малюють те саме без стану.
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Switch light or dark theme"
      title="Switch light or dark theme"
      // Зона натискання 40px і суцільне кільце фокусу — як у Button застосунку (DESIGN.md, розділи 4 і 7).
      className={cn(
        "size-10 text-muted-foreground focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <Moon className="size-4 dark:hidden" aria-hidden />
      <Sun className="hidden size-4 dark:block" aria-hidden />
    </Button>
  );
}
