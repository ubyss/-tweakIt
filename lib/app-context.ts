"use client";

import { createContext, useContext } from "react";
import type { Locale, Messages } from "@/lib/i18n";

export type Theme = "light" | "dark" | "system";

export type AppContextValue = {
  locale: Locale;
  copy: Messages;
  setLocale: (locale: Locale) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  favorites: readonly string[];
  recents: readonly string[];
  storageReady: boolean;
  toggleFavorite: (id: string) => void;
  addRecent: (id: string) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
};

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppContext is unavailable");
  return value;
}
