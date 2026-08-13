"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { dictionary, I18nContext, type Locale, type Messages } from "@/lib/i18n";

export type Theme = "light" | "dark" | "system";

type AppContextValue = {
  locale: Locale;
  copy: Messages;
  setLocale: (locale: Locale) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  favorites: readonly string[];
  recents: readonly string[];
  toggleFavorite: (id: string) => void;
  addRecent: (id: string) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
};

const AppContext = createContext<AppContextValue | null>(null);
const preferencesKey = "toolsy:preferences:v1";
const favoritesKey = "toolsy:favorites:v1";
const recentsKey = "toolsy:recents:v1";

function readArray(key: string) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function readStoredState() {
  try {
    const preferences = JSON.parse(localStorage.getItem(preferencesKey) ?? "{}") as { locale?: unknown; theme?: unknown };
    const locale: Locale = preferences.locale === "en" || preferences.locale === "pt-BR" ? preferences.locale : navigator.language.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
    const theme: Theme = preferences.theme === "light" || preferences.theme === "dark" || preferences.theme === "system" ? preferences.theme : "system";
    return { locale, theme, favorites: readArray(favoritesKey), recents: readArray(recentsKey).slice(0, 6) };
  } catch {
    return { locale: "pt-BR" as Locale, theme: "system" as Theme, favorites: [] as string[], recents: [] as string[] };
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pt-BR");
  const [theme, setThemeState] = useState<Theme>("system");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readStoredState();
      setLocaleState(stored.locale);
      setThemeState(stored.theme);
      setFavorites(stored.favorites);
      setRecents(stored.recents);
      setPreferencesReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    if (!preferencesReady) return;
    try {
      localStorage.setItem(preferencesKey, JSON.stringify({ locale, theme }));
    } catch { return; }
  }, [locale, preferencesReady, theme]);

  useEffect(() => {
    applyTheme(theme);
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => theme === "system" && applyTheme(theme);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => setLocaleState(nextLocale), []);
  const setTheme = useCallback((nextTheme: Theme) => setThemeState(nextTheme), []);
  const toggleFavorite = useCallback((id: string) => {
    setFavorites(current => {
      const next = current.includes(id) ? current.filter(item => item !== id) : [id, ...current];
      try { localStorage.setItem(favoritesKey, JSON.stringify(next)); } catch { return next; }
      return next;
    });
  }, []);
  const addRecent = useCallback((id: string) => {
    setRecents(current => {
      const next = [id, ...current.filter(item => item !== id)].slice(0, 6);
      try { localStorage.setItem(recentsKey, JSON.stringify(next)); } catch { return next; }
      return next;
    });
  }, []);

  const i18nValue = useMemo(() => ({ locale, copy: dictionary[locale] as Messages, setLocale }), [locale, setLocale]);
  const value = useMemo(() => ({ locale, copy: dictionary[locale] as Messages, setLocale, theme, setTheme, favorites, recents, toggleFavorite, addRecent, commandOpen, setCommandOpen }), [locale, theme, favorites, recents, toggleFavorite, addRecent, commandOpen, setTheme, setLocale]);

  return (
    <I18nContext.Provider value={i18nValue}>
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </I18nContext.Provider>
  );
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppContext is unavailable");
  return value;
}
