import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { createUISlice, type UISlice } from '../store/slices/uiSlice.js';

function createStore() {
  return create<UISlice>()((...args) => createUISlice(...args));
}

describe('UISlice', () => {
  it('starts with system theme and default panel widths', () => {
    const store = createStore();
    expect(store.getState().theme).toBe('system');
    expect(store.getState().projectPanelWidth).toBe(240);
    expect(store.getState().propertiesPanelWidth).toBe(320);
  });

  it('setTheme — changes theme', () => {
    const store = createStore();
    store.getState().setTheme('dark');
    expect(store.getState().theme).toBe('dark');
  });

  it('pushToast / dismissToast', () => {
    const store = createStore();
    store.getState().pushToast({ message: 'Saved!', severity: 'success' });
    expect(store.getState().toastQueue).toHaveLength(1);
    expect(store.getState().toastQueue[0].message).toBe('Saved!');

    const id = store.getState().toastQueue[0].id;
    store.getState().dismissToast(id);
    expect(store.getState().toastQueue).toHaveLength(0);
  });

  it('multiple toasts accumulate', () => {
    const store = createStore();
    store.getState().pushToast({ message: 'A', severity: 'info' });
    store.getState().pushToast({ message: 'B', severity: 'warning' });
    expect(store.getState().toastQueue).toHaveLength(2);
  });

  it('setZoom — updates zoom level', () => {
    const store = createStore();
    store.getState().setZoom(1.5);
    expect(store.getState().zoom).toBe(1.5);
  });

  it('setProjectPanelWidth — updates width', () => {
    const store = createStore();
    store.getState().setProjectPanelWidth(300);
    expect(store.getState().projectPanelWidth).toBe(300);
  });
});
