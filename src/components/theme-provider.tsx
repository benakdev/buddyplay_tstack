'use client';

import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'ui-theme';
const userThemes = ['light', 'dark', 'system'] as const;

export type UserTheme = (typeof userThemes)[number];
export type AppTheme = Exclude<UserTheme, 'system'>;

type ThemeContextValue = {
  userTheme: UserTheme;
  appTheme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isUserTheme(value: string | null): value is UserTheme {
  return value !== null && userThemes.includes(value as UserTheme);
}

function getStoredUserTheme(): UserTheme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isUserTheme(stored) ? stored : 'dark';
  } catch {
    return 'dark';
  }
}

function setStoredTheme(theme: UserTheme): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // no-op
  }
}

function getSystemTheme(): AppTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveAppTheme(theme: UserTheme): AppTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(userTheme: UserTheme) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.classList.remove('light', 'dark', 'system');

  const appTheme = resolveAppTheme(userTheme);
  root.classList.add(appTheme);

  if (userTheme === 'system') {
    root.classList.add('system');
  }
}

export const themeScript: string = (function () {
  function themeInit() {
    try {
      const stored = localStorage.getItem('ui-theme');
      const validTheme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark';

      document.documentElement.classList.remove('light', 'dark', 'system');

      if (validTheme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.classList.add(systemTheme, 'system');
      } else {
        document.documentElement.classList.add(validTheme);
      }
    } catch {
      document.documentElement.classList.remove('light', 'system');
      document.documentElement.classList.add('dark');
    }
  }

  return `(${themeInit.toString()})();`;
})();

function setupSystemPreferenceListener(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [userTheme, setUserTheme] = useState<UserTheme>(getStoredUserTheme);

  useEffect(() => {
    applyTheme(userTheme);
  }, [userTheme]);

  useEffect(() => {
    if (userTheme !== 'system') return;

    return setupSystemPreferenceListener(() => {
      applyTheme('system');
    });
  }, [userTheme]);

  const appTheme = resolveAppTheme(userTheme);

  const setTheme = (theme: AppTheme) => {
    setUserTheme(theme);
    setStoredTheme(theme);
    applyTheme(theme);
  };

  const toggleTheme = () => {
    setTheme(appTheme === 'dark' ? 'light' : 'dark');
  };

  const value: ThemeContextValue = {
    userTheme,
    appTheme,
    setTheme,
    toggleTheme
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
