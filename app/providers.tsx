"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { AppContext, type Theme } from "@/lib/app-context";
import { dictionary, I18nContext, type Locale, type Messages } from "@/lib/i18n";

const preferencesKey = "tweakit:preferences:v1";
const favoritesKey = "tweakit:favorites:v1";
const recentsKey = "tweakit:recents:v1";
const legacyPreferencesKey = "toolsy:preferences:v1";
const legacyFavoritesKey = "toolsy:favorites:v1";
const legacyRecentsKey = "toolsy:recents:v1";

type StoredState = {
  locale: Locale;
  theme: Theme;
  favorites: string[];
  recents: string[];
};

const defaultStoredState: StoredState = {
  locale: "pt-BR",
  theme: "system",
  favorites: [],
  recents: [],
};

let sessionStore: StoredState | null = null;

function readArray(key: string, legacyKey: string) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? localStorage.getItem(legacyKey) ?? "[]");
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

function readStoredState(): StoredState {
  try {
    const preferences = JSON.parse(localStorage.getItem(preferencesKey) ?? localStorage.getItem(legacyPreferencesKey) ?? "{}") as { locale?: unknown; theme?: unknown };
    const locale: Locale = preferences.locale === "en" || preferences.locale === "pt-BR" ? preferences.locale : navigator.language.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
    const theme: Theme = preferences.theme === "light" || preferences.theme === "dark" || preferences.theme === "system" ? preferences.theme : "system";
    return { locale, theme, favorites: readArray(favoritesKey, legacyFavoritesKey), recents: readArray(recentsKey, legacyRecentsKey).slice(0, 6) };
  } catch {
    return { ...defaultStoredState };
  }
}

function ensureSessionStore(): StoredState {
  if (!sessionStore) sessionStore = readStoredState();
  return sessionStore;
}

function patchSessionStore(patch: Partial<StoredState>) {
  sessionStore = { ...ensureSessionStore(), ...patch };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => sessionStore?.locale ?? "pt-BR");
  const [theme, setThemeState] = useState<Theme>(() => sessionStore?.theme ?? "system");
  const [favorites, setFavorites] = useState<string[]>(() => sessionStore?.favorites ?? []);
  const [recents, setRecents] = useState<string[]>(() => sessionStore?.recents ?? []);
  const [commandOpen, setCommandOpen] = useState(false);
  const [storageReady, setStorageReady] = useState(() => sessionStore !== null);

  useLayoutEffect(() => {
    const stored = ensureSessionStore();
    setLocaleState(stored.locale);
    setThemeState(stored.theme);
    setFavorites(stored.favorites);
    setRecents(stored.recents);
    setStorageReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    if (!storageReady) return;
    try {
      localStorage.setItem(preferencesKey, JSON.stringify({ locale, theme }));
      patchSessionStore({ locale, theme });
    } catch {
      return;
    }
  }, [locale, storageReady, theme]);

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
      patchSessionStore({ favorites: next });
      try { localStorage.setItem(favoritesKey, JSON.stringify(next)); } catch { return next; }
      return next;
    });
  }, []);
  const addRecent = useCallback((id: string) => {
    setRecents(current => {
      const next = [id, ...current.filter(item => item !== id)].slice(0, 6);
      patchSessionStore({ recents: next });
      try { localStorage.setItem(recentsKey, JSON.stringify(next)); } catch { return next; }
      return next;
    });
  }, []);

  const i18nValue = useMemo(() => ({ locale, copy: dictionary[locale] as Messages, setLocale }), [locale, setLocale]);
  const value = useMemo(() => ({
    locale,
    copy: dictionary[locale] as Messages,
    setLocale,
    theme,
    setTheme,
    favorites,
    recents,
    storageReady,
    toggleFavorite,
    addRecent,
    commandOpen,
    setCommandOpen,
  }), [locale, theme, favorites, recents, storageReady, toggleFavorite, addRecent, commandOpen, setTheme, setLocale]);

  return (
    <I18nContext.Provider value={i18nValue}>
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </I18nContext.Provider>
  );
}
