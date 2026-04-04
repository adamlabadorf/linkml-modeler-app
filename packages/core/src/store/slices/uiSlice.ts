import type { StateCreator } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';
export type SyncStatus = 'saved' | 'syncing' | 'unsaved' | 'error' | null;

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
  syncStatus: SyncStatus; // null = not in cloud mode

  // Actions
  setTheme(theme: Theme): void;
  setProjectPanelWidth(width: number): void;
  setPropertiesPanelWidth(width: number): void;
  pushToast(toast: Omit<Toast, 'id'>): void;
  dismissToast(id: string): void;
  setZoom(zoom: number): void;
  setSyncStatus(status: SyncStatus): void;
}

let toastCounter = 0;

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  theme: 'system',
  projectPanelWidth: 240,
  propertiesPanelWidth: 320,
  toastQueue: [],
  zoom: 1,
  syncStatus: null,

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

  setSyncStatus(status) {
    set({ syncStatus: status });
  },
});
