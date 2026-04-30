import type { StateCreator } from 'zustand';
import type { Theme } from '../../ui/useTheme.js';

export type { Theme };
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
  /** Schema IDs that are hidden in the project panel / canvas */
  hiddenSchemaIds: Set<string>;

  // Actions
  setTheme(theme: Theme): void;
  setProjectPanelWidth(width: number): void;
  setPropertiesPanelWidth(width: number): void;
  pushToast(toast: Omit<Toast, 'id'>): void;
  dismissToast(id: string): void;
  setZoom(zoom: number): void;
  setSyncStatus(status: SyncStatus): void;
  setSchemaVisible(schemaId: string, visible: boolean): void;
  /** Bulk-set hidden IDs, typically called when loading a project manifest. */
  setHiddenSchemaIds(ids: Set<string>): void;
}

let toastCounter = 0;

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  theme: 'system',
  projectPanelWidth: 240,
  propertiesPanelWidth: 320,
  toastQueue: [],
  zoom: 1,
  syncStatus: null,
  hiddenSchemaIds: new Set(),

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

  setSchemaVisible(schemaId, visible) {
    set((state) => {
      const next = new Set(state.hiddenSchemaIds);
      if (visible) next.delete(schemaId);
      else next.add(schemaId);
      return { hiddenSchemaIds: next };
    });
  },

  setHiddenSchemaIds(ids) {
    set({ hiddenSchemaIds: ids });
  },
});
