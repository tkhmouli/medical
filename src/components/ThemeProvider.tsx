'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark' | 'purple';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ─── Provider ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'clinic-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  // Load saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved && ['light', 'dark', 'purple'].includes(saved)) {
      setThemeState(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
    setMounted(true);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  // Prevent flash of wrong theme
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
