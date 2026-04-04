import { createContext, useContext } from 'react';

// ─── File I/O types ───────────────────────────────────────────────────────────

export interface OpenFileOptions {
  accept?: string[]; // e.g. ['.yaml', '.yml']
  title?: string;
}

export interface SaveFileOptions {
  suggestedName?: string;
  accept?: string[];
  title?: string;
}

export interface FileResult {
  path: string;
  content: string;
}

export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

// ─── Git types ────────────────────────────────────────────────────────────────

export interface GitStatus {
  branch: string;
  aheadCount: number;
  behindCount: number;
  stagedFiles: string[];
  unstagedFiles: string[];
  untrackedFiles: string[];
}

export interface GitPushResult {
  ok: boolean;
  error?: string;
}

export interface GitCloneOptions {
  branch?: string;
  credentials?: GitCredentials;
  onProgress?: (phase: string, loaded: number, total: number) => void;
}

export interface GitCloneResult {
  ok: boolean;
  destPath: string;
  error?: string;
}

export interface GitCommit {
  oid: string;
  message: string;
  author: { name: string; email: string; timestamp: number };
}

// ─── Platform API ─────────────────────────────────────────────────────────────

export interface GitCredentials {
  username: string;
  password: string;
}

export interface PlatformAPI {
  // File system
  openFile(options?: OpenFileOptions): Promise<FileResult | null>;
  saveFile(options: SaveFileOptions, content: string): Promise<string | null>;
  openDirectory(): Promise<string | null>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDirectory(path: string): Promise<DirEntry[]>;

  // Git — all methods no-op / return null when git unavailable
  gitStatus(repoPath: string): Promise<GitStatus | null>;
  gitStage(repoPath: string, paths: string[]): Promise<void>;
  gitCommit(repoPath: string, message: string): Promise<string | null>;
  gitPush(repoPath: string, onAuth?: (url: string) => Promise<GitCredentials | null>): Promise<GitPushResult | null>;
  gitLog(repoPath: string, limit: number): Promise<GitCommit[]>;
  gitClone(url: string, destPath: string, options?: GitCloneOptions): Promise<GitCloneResult>;

  // Credential storage (secure, per-environment)
  storeCredential(key: string, value: string): Promise<void>;
  getCredential(key: string): Promise<string | null>;
  deleteCredential(key: string): Promise<void>;

  // Persistent app settings (non-sensitive)
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // Environment
  platform: 'web' | 'electron';
  gitAvailable: boolean; // Detected at startup
}

// ─── React context ────────────────────────────────────────────────────────────

export const PlatformContext = createContext<PlatformAPI | null>(null);

export function usePlatform(): PlatformAPI {
  const ctx = useContext(PlatformContext);
  if (!ctx) {
    throw new Error('usePlatform must be used inside a <PlatformProvider>');
  }
  return ctx;
}
