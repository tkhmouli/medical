'use client';

import { useTheme, type Theme } from '@/components/ThemeProvider';

const THEMES: { id: Theme; label: string; icon: string }[] = [
  { id: 'light', label: 'Light', icon: '☀️' },
  { id: 'dark', label: 'Dark', icon: '🌙' },
  { id: 'purple', label: 'Purple', icon: '💜' },
];

/**
 * Compact theme switcher — renders 3 small buttons to toggle between
 * light, dark, and purple modes.
 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1">
      {THEMES.map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          title={t.label}
          className={`rounded-md px-2 py-1 text-xs transition-all ${
            theme === t.id
              ? 'theme-bg-tertiary theme-text-primary font-medium ring-1 ring-inset theme-border'
              : 'theme-text-muted hover:theme-text-secondary'
          }`}
          aria-label={`Switch to ${t.label} theme`}
          aria-pressed={theme === t.id}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}
