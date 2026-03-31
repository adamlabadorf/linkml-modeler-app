import type { StateCreator } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

export interface Toast {
  id: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  durationMs?: number;
}

export interface UISlice {
  // State
  theme: Theme;
  projectPanelWidth: number; // px
  propertiesPanelWidth: number; // px
  toastQueue: Toast[];
  zoom: number; // canvas zoom level mirror for status bar

  // Actions
  setTheme(theme: Theme): void;
  setProjectPanelWidth(width: number): void;
  setPropertiesPanelWidth(width: number): void;
  pushToast(toast: Omit<Toast, 'id'>): void;
  dismissToast(id: string): void;
  setZoom(zoom: number): void;
}

let toastCounter = 0;

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  theme: 'system',
  projectPanelWidth: 240,
  propertiesPanelWidth: 320,
  toastQueue: [],
  zoom: 1,

  setTheme(theme) {
    set({ theme });
  },

  setProjectPanelWidth(width) {
    set({ projectPanelWidth: width });
  },

  setPropertiesPanelWidth(width) {
    set({ propertiesPanelWidth: width });
  },

  pushToast(toast) {
    const id = `toast-${++toastCounter}`;
    set((state) => ({ toastQueue: [...state.toastQueue, { ...toast, id }] }));
  },

  dismissToast(id) {
    set((state) => ({ toastQueue: state.toastQueue.filter((t) => t.id !== id) }));
  },

  setZoom(zoom) {
    set({ zoom });
  },
});
