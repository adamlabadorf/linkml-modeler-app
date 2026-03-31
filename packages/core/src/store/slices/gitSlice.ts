import type { StateCreator } from 'zustand';
import type { GitStatus, GitCommit } from '../../platform/PlatformContext.js';

export type { GitStatus, GitCommit };

export interface GitSlice {
  // State
  gitAvailable: boolean;
  gitStatus: GitStatus | null;
  commitLog: GitCommit[];
  commitMessage: string;
  stagedPaths: Set<string>;
  isCommitting: boolean;
  isPushing: boolean;
  lastGitError: string | null;

  // Actions
  setGitAvailable(available: boolean): void;
  setGitStatus(status: GitStatus | null): void;
  setCommitLog(log: GitCommit[]): void;
  setCommitMessage(message: string): void;
  stageFile(path: string): void;
  unstageFile(path: string): void;
  stageAll(): void;
  clearStaged(): void;
  setIsCommitting(value: boolean): void;
  setIsPushing(value: boolean): void;
  setLastGitError(error: string | null): void;
}

export const createGitSlice: StateCreator<GitSlice, [], [], GitSlice> = (set, get) => ({
  gitAvailable: false,
  gitStatus: null,
  commitLog: [],
  commitMessage: '',
  stagedPaths: new Set(),
  isCommitting: false,
  isPushing: false,
  lastGitError: null,

  setGitAvailable(available) {
    set({ gitAvailable: available });
  },

  setGitStatus(status) {
    set({ gitStatus: status });
  },

  setCommitLog(log) {
    set({ commitLog: log });
  },

  setCommitMessage(message) {
    set({ commitMessage: message });
  },

  stageFile(path) {
    const next = new Set(get().stagedPaths);
    next.add(path);
    set({ stagedPaths: next });
  },

  unstageFile(path) {
    const next = new Set(get().stagedPaths);
    next.delete(path);
    set({ stagedPaths: next });
  },

  stageAll() {
    const { gitStatus } = get();
    if (!gitStatus) return;
    const all = [
      ...gitStatus.stagedFiles,
      ...gitStatus.unstagedFiles,
      ...gitStatus.untrackedFiles,
    ];
    set({ stagedPaths: new Set(all) });
  },

  clearStaged() {
    set({ stagedPaths: new Set() });
  },

  setIsCommitting(value) {
    set({ isCommitting: value });
  },

  setIsPushing(value) {
    set({ isPushing: value });
  },

  setLastGitError(error) {
    set({ lastGitError: error });
  },
});
