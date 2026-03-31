import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { createGitSlice, type GitSlice, type GitStatus } from '../store/slices/gitSlice.js';

function createStore() {
  return create<GitSlice>()((...args) => createGitSlice(...args));
}

const mockStatus: GitStatus = {
  branch: 'main',
  aheadCount: 1,
  behindCount: 0,
  stagedFiles: ['schema/core.yaml'],
  unstagedFiles: ['schema/types.yaml'],
  untrackedFiles: ['new-schema.yaml'],
};

describe('GitSlice', () => {
  it('starts unavailable with no status', () => {
    const store = createStore();
    expect(store.getState().gitAvailable).toBe(false);
    expect(store.getState().gitStatus).toBeNull();
  });

  it('setGitAvailable — toggles availability', () => {
    const store = createStore();
    store.getState().setGitAvailable(true);
    expect(store.getState().gitAvailable).toBe(true);
  });

  it('setGitStatus — stores status', () => {
    const store = createStore();
    store.getState().setGitStatus(mockStatus);
    expect(store.getState().gitStatus?.branch).toBe('main');
    expect(store.getState().gitStatus?.aheadCount).toBe(1);
  });

  it('stageFile / unstageFile', () => {
    const store = createStore();
    store.getState().stageFile('a.yaml');
    expect(store.getState().stagedPaths.has('a.yaml')).toBe(true);

    store.getState().unstageFile('a.yaml');
    expect(store.getState().stagedPaths.has('a.yaml')).toBe(false);
  });

  it('stageAll — stages all files from status', () => {
    const store = createStore();
    store.getState().setGitStatus(mockStatus);
    store.getState().stageAll();

    const staged = store.getState().stagedPaths;
    expect(staged.has('schema/core.yaml')).toBe(true);
    expect(staged.has('schema/types.yaml')).toBe(true);
    expect(staged.has('new-schema.yaml')).toBe(true);
  });

  it('clearStaged — empties staged paths', () => {
    const store = createStore();
    store.getState().stageFile('a.yaml');
    store.getState().clearStaged();
    expect(store.getState().stagedPaths.size).toBe(0);
  });

  it('setLastGitError — stores and clears errors', () => {
    const store = createStore();
    store.getState().setLastGitError('push failed: auth error');
    expect(store.getState().lastGitError).toBe('push failed: auth error');

    store.getState().setLastGitError(null);
    expect(store.getState().lastGitError).toBeNull();
  });
});
