import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createProjectSlice, type ProjectSlice } from './slices/projectSlice.js';
import { createCanvasSlice, type CanvasSlice } from './slices/canvasSlice.js';
import { createEditorSlice, type EditorSlice } from './slices/editorSlice.js';
import { createGitSlice, type GitSlice } from './slices/gitSlice.js';
import { createUISlice, type UISlice } from './slices/uiSlice.js';

export type AppStore = ProjectSlice & CanvasSlice & EditorSlice & GitSlice & UISlice;

export const useAppStore = create<AppStore>()(
  devtools(
    (...args) => ({
      ...createProjectSlice(...args),
      ...createCanvasSlice(...args),
      ...createEditorSlice(...args),
      ...createGitSlice(...args),
      ...createUISlice(...args),
    }),
    { name: 'LinkMLEditorStore' }
  )
);

// Typed selectors for common access patterns
export const useProject = () => useAppStore((s) => s.activeProject);
export const useActiveSchema = () => useAppStore((s) => s.getActiveSchema());
export const useIsDirty = () => useAppStore((s) => s.getIsDirty());
export const useTheme = () => useAppStore((s) => s.theme);
export const useGitAvailable = () => useAppStore((s) => s.gitAvailable);
export const useFocusMode = () => useAppStore((s) => s.focusMode);

export * from './slices/projectSlice.js';
export * from './slices/canvasSlice.js';
export * from './slices/editorSlice.js';
export * from './slices/gitSlice.js';
export * from './slices/uiSlice.js';
