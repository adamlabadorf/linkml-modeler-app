import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'linkml-editor-theme';

function getSystemResolved(): 'dark' | 'light' {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolveTheme(theme: Theme): 'dark' | 'light' {
  return theme === 'system' ? getSystemResolved() : theme;
}

function applyDataTheme(resolved: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', resolved);
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage unavailable (e.g., sandboxed iframe)
  }
  return 'system';
}

export function useTheme(): {
  theme: Theme;
  resolved: 'dark' | 'light';
  setTheme: (t: Theme) => void;
} {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  const resolved = resolveTheme(theme);

  // Apply data-theme to <html> whenever resolved changes.
  useEffect(() => {
    applyDataTheme(resolved);
  }, [resolved]);

  // Subscribe to system preference changes when in 'system' mode.
  useEffect(() => {
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyDataTheme(resolveTheme('system'));
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore write failures
    }
    applyDataTheme(resolveTheme(t));
    setThemeState(t);
  };

  return { theme, resolved, setTheme };
}
