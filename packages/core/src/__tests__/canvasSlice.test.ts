import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { createCanvasSlice, type CanvasSlice } from '../store/slices/canvasSlice.js';
import type { Node } from 'reactflow';
import type { CanvasNodeData } from '../store/slices/canvasSlice.js';

function createStore() {
  return create<CanvasSlice>()((...args) => createCanvasSlice(...args));
}

function makeNode(id: string, entityType: 'class' | 'enum' = 'class'): Node<CanvasNodeData> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { entityId: id, entityType },
  };
}

describe('CanvasSlice', () => {
  it('starts empty', () => {
    const store = createStore();
    expect(store.getState().nodes).toHaveLength(0);
    expect(store.getState().edges).toHaveLength(0);
    expect(store.getState().focusMode).toBeNull();
  });

  it('setNodes — replaces node list', () => {
    const store = createStore();
    const nodes = [makeNode('A'), makeNode('B')];
    store.getState().setNodes(nodes);
    expect(store.getState().nodes).toHaveLength(2);
  });

  it('updateNodePosition — moves a specific node', () => {
    const store = createStore();
    store.getState().setNodes([makeNode('A')]);
    store.getState().updateNodePosition('A', 100, 200);

    const node = store.getState().nodes[0];
    expect(node.position).toEqual({ x: 100, y: 200 });
  });

  it('setSelection / clearSelection', () => {
    const store = createStore();
    store.getState().setSelection(['A', 'B'], ['e1']);
    expect(store.getState().selectedNodeIds).toEqual(['A', 'B']);
    expect(store.getState().selectedEdgeIds).toEqual(['e1']);

    store.getState().clearSelection();
    expect(store.getState().selectedNodeIds).toHaveLength(0);
  });

  it('setFocusMode — enters and exits subset focus', () => {
    const store = createStore();
    store.getState().setFocusMode({ type: 'subset', subsetName: 'core' });
    expect(store.getState().focusMode).toEqual({ type: 'subset', subsetName: 'core' });

    store.getState().setFocusMode(null);
    expect(store.getState().focusMode).toBeNull();
  });

  it('toggleNodeCollapsed — flips collapsed flag', () => {
    const store = createStore();
    store.getState().setNodes([makeNode('A')]);

    store.getState().toggleNodeCollapsed('A');
    expect(store.getState().nodes[0].data.collapsed).toBe(true);

    store.getState().toggleNodeCollapsed('A');
    expect(store.getState().nodes[0].data.collapsed).toBe(false);
  });
});
