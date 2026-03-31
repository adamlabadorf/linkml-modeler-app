import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { createEditorSlice, type EditorSlice } from '../store/slices/editorSlice.js';

function createStore() {
  return create<EditorSlice>()((...args) => createEditorSlice(...args));
}

describe('EditorSlice', () => {
  it('starts with no active entity and panels in default state', () => {
    const store = createStore();
    expect(store.getState().activeEntity).toBeNull();
    expect(store.getState().propertiesPanelOpen).toBe(true);
    expect(store.getState().projectPanelOpen).toBe(true);
    expect(store.getState().gitPanelOpen).toBe(false);
  });

  it('setActiveEntity — stores class entity', () => {
    const store = createStore();
    store.getState().setActiveEntity({ type: 'class', className: 'Person' });
    expect(store.getState().activeEntity).toEqual({ type: 'class', className: 'Person' });
  });

  it('setActiveEntity — stores slot entity', () => {
    const store = createStore();
    store.getState().setActiveEntity({ type: 'slot', className: 'Person', slotName: 'name' });
    expect(store.getState().activeEntity).toEqual({
      type: 'slot',
      className: 'Person',
      slotName: 'name',
    });
  });

  it('clearActiveEntity — resets to null', () => {
    const store = createStore();
    store.getState().setActiveEntity({ type: 'enum', enumName: 'Status' });
    store.getState().clearActiveEntity();
    expect(store.getState().activeEntity).toBeNull();
  });

  it('panel toggles work independently', () => {
    const store = createStore();
    store.getState().setGitPanelOpen(true);
    expect(store.getState().gitPanelOpen).toBe(true);

    store.getState().setPropertiesPanelOpen(false);
    expect(store.getState().propertiesPanelOpen).toBe(false);
    expect(store.getState().gitPanelOpen).toBe(true); // unaffected
  });
});
