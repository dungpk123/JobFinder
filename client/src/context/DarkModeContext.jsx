import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'jobfinder-theme';
const LEGACY_THEME_STORAGE_KEY = 'darkMode';

const DarkModeContext = createContext(undefined);

const parseStoredTheme = (rawValue) => {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (normalized === 'dark' || normalized === 'light') {
    return normalized;
  }
  return '';
};

const resolveInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';

  const storedTheme = parseStoredTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  if (storedTheme) return storedTheme;

  const legacyRaw = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  if (legacyRaw !== null) {
    try {
      const parsedLegacy = JSON.parse(legacyRaw);
      if (typeof parsedLegacy === 'boolean') {
        return parsedLegacy ? 'dark' : 'light';
      }
      const legacyTheme = parseStoredTheme(parsedLegacy);
      if (legacyTheme) return legacyTheme;
    } catch {
      const legacyTheme = parseStoredTheme(legacyRaw);
      if (legacyTheme) return legacyTheme;
    }
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyThemeToRoot = (theme) => {
  if (typeof document === 'undefined') return;

  const safeTheme = theme === 'dark' ? 'dark' : 'light';
  const root = document.documentElement;

  root.setAttribute('data-bs-theme', safeTheme);
  root.classList.toggle('dark', safeTheme === 'dark');
  root.style.colorScheme = safeTheme;
};

export const DarkModeProvider = ({ children }) => {
  const [theme, setTheme] = useState(resolveInitialTheme);

  useEffect(() => {
    applyThemeToRoot(theme);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, JSON.stringify(theme === 'dark'));
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleStorageSync = (event) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== LEGACY_THEME_STORAGE_KEY) return;

      if (event.key === THEME_STORAGE_KEY) {
        const nextTheme = parseStoredTheme(event.newValue);
        if (nextTheme) {
          setTheme(nextTheme);
        }
        return;
      }

      try {
        const parsed = JSON.parse(String(event.newValue || ''));
        if (typeof parsed === 'boolean') {
          setTheme(parsed ? 'dark' : 'light');
        }
      } catch {
        const fallbackTheme = parseStoredTheme(event.newValue);
        if (fallbackTheme) {
          setTheme(fallbackTheme);
        }
      }
    };

    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  const toggleDarkMode = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const value = useMemo(() => ({
    theme,
    isDarkMode: theme === 'dark',
    setTheme,
    toggleDarkMode
  }), [theme]);

  return <DarkModeContext.Provider value={value}>{children}</DarkModeContext.Provider>;
};

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};
