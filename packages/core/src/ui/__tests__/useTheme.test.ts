import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme.js';

const STORAGE_KEY = 'linkml-editor-theme';

let mockDarkMedia: boolean;
let mediaListeners: Array<(e: { matches: boolean }) => void>;

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  mockDarkMedia = false;
  mediaListeners = [];

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? mockDarkMedia : false,
      media: query,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
        mediaListeners.push(fn);
      },
      removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
        mediaListeners = mediaListeners.filter((l) => l !== fn);
      },
      dispatchEvent: () => false,
    }),
  });
});

describe('useTheme — initial state', () => {
  it('defaults to system when no localStorage value', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
  });

  it('reads stored "dark" from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolved).toBe('dark');
  });

  it('reads stored "light" from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(result.current.resolved).toBe('light');
  });

  it('falls back to system for an invalid stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
  });
});

describe('useTheme — system resolution', () => {
  it('resolves system to dark when prefers-color-scheme: dark', () => {
    mockDarkMedia = true;
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe('dark');
  });

  it('resolves system to light when prefers-color-scheme: light', () => {
    mockDarkMedia = false;
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe('light');
  });
});

describe('useTheme — data-theme side effect', () => {
  it('sets data-theme="dark" on html element in dark mode', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('sets data-theme="light" on html element in light mode', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('reflects system preference on html element', () => {
    mockDarkMedia = true;
    renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('useTheme — setTheme', () => {
  it('persists choice to localStorage', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.setTheme('light'); });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('updates theme and resolved after setTheme', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.setTheme('light'); });
    expect(result.current.theme).toBe('light');
    expect(result.current.resolved).toBe('light');
  });

  it('updates data-theme attribute immediately on setTheme', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.setTheme('light'); });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('resolves system theme after switching to system', () => {
    mockDarkMedia = true;
    localStorage.setItem(STORAGE_KEY, 'light');
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.setTheme('system'); });
    expect(result.current.theme).toBe('system');
    expect(result.current.resolved).toBe('dark');
  });
});

describe('useTheme — system prefers-color-scheme listener', () => {
  it('updates data-theme when system preference changes while in system mode', () => {
    mockDarkMedia = false;
    const { result } = renderHook(() => useTheme());
    expect(result.current.resolved).toBe('light');

    // Simulate OS switching to dark mode
    mockDarkMedia = true;
    act(() => {
      mediaListeners.forEach((fn) => fn({ matches: true }));
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('does not listen for system changes when a fixed theme is set', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    renderHook(() => useTheme());
    expect(mediaListeners).toHaveLength(0);
  });
});
