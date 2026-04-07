/**
 * WebPlatform — production web implementation of PlatformAPI.
 *
 * File I/O: File System Access API (FSAA) with download/upload fallback.
 * Git:      isomorphic-git backed by @isomorphic-git/lightning-fs (OPFS).
 *
 * Credential handling: in-memory only (prompted per-push); no persistent storage.
 */
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import LightningFS from '@isomorphic-git/lightning-fs';
import type {
  PlatformAPI,
  OpenFileOptions,
  SaveFileOptions,
  FileResult,
  DirEntry,
  GitStatus,
  GitPushResult,
  GitCommit,
  GitCredentials,
  GitCloneOptions,
  GitCloneResult,
} from '@linkml-editor/core';
import { friendlyGitError } from './gitErrorMessages.js';

// ── LightningFS singleton (OPFS-backed) ───────────────────────────────────────
const fs = new LightningFS('linkml-editor-fs');
const pfs = fs.promises;

// GitHub (and most git hosts) don't set CORS headers, so browser fetch() is
// blocked. Route all remote git operations through this CORS proxy.
// See: https://isomorphic-git.org/docs/en/cors_proxy
const CORS_PROXY = 'https://cors.isomorphic-git.org';

// ── FSAA availability ─────────────────────────────────────────────────────────
const FSAA_AVAILABLE =
  typeof window !== 'undefined' &&
  'showOpenFilePicker' in window &&
  'showSaveFilePicker' in window;

// ── Detect if any git repo is present ─────────────────────────────────────────
async function detectGit(repoPath: string): Promise<boolean> {
  try {
    await git.resolveRef({ fs, dir: repoPath, ref: 'HEAD' });
    return true;
  } catch {
    return false;
  }
}

// ── WebPlatform ───────────────────────────────────────────────────────────────

export class WebPlatform implements PlatformAPI {
  readonly platform = 'web' as const;
  gitAvailable = false;

  // In-memory credential store (cleared on page unload)
  private _credentials: Map<string, { username: string; password: string }> = new Map();

  async init(repoPath?: string): Promise<void> {
    if (repoPath) {
      this.gitAvailable = await detectGit(repoPath);
    }
  }

  async initGit(dirPath: string): Promise<boolean> {
    this.gitAvailable = await detectGit(dirPath);
    return this.gitAvailable;
  }

  async gitCreateRepo(dirPath: string): Promise<boolean> {
    try {
      await git.init({ fs, dir: dirPath, defaultBranch: 'main' });
      this.gitAvailable = true;
      return true;
    } catch (e) {
      console.error('[WebPlatform.gitCreateRepo]', e);
      return false;
    }
  }

  async gitSetRemote(repoPath: string, url: string): Promise<void> {
    try {
      // Delete existing origin if present, then re-add
      try { await git.deleteRemote({ fs, dir: repoPath, remote: 'origin' }); } catch { /* ok */ }
      await git.addRemote({ fs, dir: repoPath, remote: 'origin', url });
    } catch (e) {
      console.error('[WebPlatform.gitSetRemote]', e);
    }
  }

  async gitReadConfig(repoPath: string): Promise<{ remoteUrl?: string; userName?: string; userEmail?: string }> {
    try {
      const [remoteUrl, userName, userEmail] = await Promise.all([
        git.getConfig({ fs, dir: repoPath, path: 'remote.origin.url' }).catch(() => undefined) as Promise<string | undefined>,
        git.getConfig({ fs, dir: repoPath, path: 'user.name' }).catch(() => undefined) as Promise<string | undefined>,
        git.getConfig({ fs, dir: repoPath, path: 'user.email' }).catch(() => undefined) as Promise<string | undefined>,
      ]);
      return { remoteUrl, userName, userEmail };
    } catch {
      return {};
    }
  }

  async getProjectsPath(): Promise<string> {
    return '/projects';
  }

  // ── File I/O ────────────────────────────────────────────────────────────────

  async openFile(options?: OpenFileOptions): Promise<FileResult | null> {
    if (FSAA_AVAILABLE) {
      try {
        const [fileHandle] = await (window as unknown as { showOpenFilePicker: (opts: unknown) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
          types: options?.accept
            ? [{ description: 'Files', accept: { 'text/*': options.accept } }]
            : undefined,
          multiple: false,
        });
        const file = await fileHandle.getFile();
        const content = await file.text();
        return { path: file.name, content };
      } catch (e: unknown) {
        // AbortError means user cancelled
        if ((e as { name?: string }).name === 'AbortError') return null;
        throw e;
      }
    }

    // Fallback: hidden <input type="file"> upload
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      if (options?.accept) input.accept = options.accept.join(',');
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const content = await file.text();
        resolve({ path: file.name, content });
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  async saveFile(options: SaveFileOptions, content: string): Promise<string | null> {
    if (FSAA_AVAILABLE) {
      try {
        const fileHandle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: options.suggestedName ?? 'schema.yaml',
          types: options.accept
            ? [{ description: 'Files', accept: { 'text/*': options.accept } }]
            : undefined,
        });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        const file = await fileHandle.getFile();
        return file.name;
      } catch (e: unknown) {
        if ((e as { name?: string }).name === 'AbortError') return null;
        throw e;
      }
    }

    // Fallback: trigger download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = options.suggestedName ?? 'schema.yaml';
    a.click();
    URL.revokeObjectURL(url);
    return options.suggestedName ?? 'schema.yaml';
  }

  async openDirectory(): Promise<string | null> {
    if (FSAA_AVAILABLE && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as Window & { showDirectoryPicker: () => Promise<{ name: string }> }).showDirectoryPicker();
        return `/${dirHandle.name}`;
      } catch (e: unknown) {
        if ((e as { name?: string }).name === 'AbortError') return null;
        throw e;
      }
    }
    return null;
  }

  async readFile(path: string): Promise<string> {
    const data = await pfs.readFile(path, { encoding: 'utf8' });
    return data as string;
  }

  async writeFile(path: string, content: string): Promise<void> {
    // Ensure parent directory exists
    const dir = path.split('/').slice(0, -1).join('/');
    if (dir) {
      await (pfs as unknown as { mkdir: (p: string, opts: { recursive: boolean }) => Promise<void> })
        .mkdir(dir, { recursive: true }).catch(() => {});
    }
    await (pfs as unknown as { writeFile: (p: string, c: string, e: string) => Promise<void> })
      .writeFile(path, content, 'utf8');
  }

  async listDirectory(path: string): Promise<DirEntry[]> {
    try {
      const entries = await pfs.readdir(path);
      const results: DirEntry[] = [];
      for (const name of entries as string[]) {
        const fullPath = `${path}/${name}`;
        try {
          const stat = await pfs.stat(fullPath);
          results.push({
            name,
            path: fullPath,
            isDirectory: stat.isDirectory(),
          });
        } catch {
          // skip unreadable entries
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  // ── Git ─────────────────────────────────────────────────────────────────────

  async gitStatus(repoPath: string): Promise<GitStatus | null> {
    if (!this.gitAvailable) return null;
    try {
      const branch = await git.currentBranch({ fs, dir: repoPath }) ?? 'HEAD';

      // FILE_STATUS: 'ignored', 'unmodified', '*modified', '*deleted', '*added',
      //              'absent', 'modified', 'deleted', 'added'
      const statusMatrix = await git.statusMatrix({ fs, dir: repoPath });

      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      for (const [filepath, headStatus, workdirStatus, stageStatus] of statusMatrix) {
        const isNewInWorktree = headStatus === 0 && workdirStatus === 2;
        const isModified = workdirStatus !== headStatus;
        const isStageDifferentFromHead = stageStatus !== headStatus;

        if (isNewInWorktree && stageStatus === 0) {
          untracked.push(filepath as string);
        } else if (isStageDifferentFromHead && stageStatus !== 0) {
          staged.push(filepath as string);
        } else if (isModified && stageStatus === headStatus) {
          unstaged.push(filepath as string);
        }
      }

      // Calculate ahead/behind — simplified: just check if there's a remote tracking branch
      let aheadCount = 0;
      let behindCount = 0;
      try {
        const remoteBranch = `refs/remotes/origin/${branch}`;
        const localRef = await git.resolveRef({ fs, dir: repoPath, ref: `refs/heads/${branch}` });
        const remoteRef = await git.resolveRef({ fs, dir: repoPath, ref: remoteBranch });
        if (localRef !== remoteRef) {
          // Use depth-limited log to approximate ahead/behind counts
          const localLog = await git.log({ fs, dir: repoPath, ref: localRef, depth: 50 });
          const remoteLog = await git.log({ fs, dir: repoPath, ref: remoteRef, depth: 50 });
          const remoteOids = new Set(remoteLog.map((c) => c.oid));
          const localOids = new Set(localLog.map((c) => c.oid));
          aheadCount = localLog.filter((c) => !remoteOids.has(c.oid)).length;
          behindCount = remoteLog.filter((c) => !localOids.has(c.oid)).length;
        }
      } catch {
        // no remote tracking branch — ok
      }

      return {
        branch,
        aheadCount,
        behindCount,
        stagedFiles: staged,
        unstagedFiles: unstaged,
        untrackedFiles: untracked,
      };
    } catch (e) {
      console.error('[WebPlatform.gitStatus]', e);
      return null;
    }
  }

  async gitStage(repoPath: string, paths: string[]): Promise<void> {
    if (!this.gitAvailable) return;
    for (const p of paths) {
      try {
        await git.add({ fs, dir: repoPath, filepath: p });
      } catch {
        // may fail for deleted files; use remove instead
        await git.remove({ fs, dir: repoPath, filepath: p }).catch(() => {});
      }
    }
  }

  async gitCommit(repoPath: string, message: string, author?: { name: string; email: string }): Promise<string | null> {
    if (!this.gitAvailable) return null;
    try {
      const oid = await git.commit({
        fs,
        dir: repoPath,
        message,
        author: author ?? { name: 'LinkML Editor', email: 'editor@linkml.io' },
      });
      return oid;
    } catch (e) {
      console.error('[WebPlatform.gitCommit]', e);
      return null;
    }
  }

  async gitPush(repoPath: string, onAuthRequest?: (url: string) => Promise<GitCredentials | null>): Promise<GitPushResult | null> {
    if (!this.gitAvailable) return null;
    try {
      const onAuth = async (url: string) => {
        const cached = this._credentials.get(url);
        if (cached) return cached;
        // Use provided callback or fall back to browser prompt
        if (onAuthRequest) {
          const creds = await onAuthRequest(url);
          if (!creds) return { cancel: true };
          this._credentials.set(url, creds);
          return creds;
        }
        const username = prompt(`Git username for ${url}:`) ?? '';
        const password = prompt(`Git password/token for ${url}:`) ?? '';
        this._credentials.set(url, { username, password });
        return { username, password };
      };

      await git.push({
        fs,
        http,
        dir: repoPath,
        corsProxy: CORS_PROXY,
        onAuth,
      });
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  }

  async gitPull(repoPath: string, onAuthRequest?: (url: string) => Promise<GitCredentials | null>): Promise<GitPushResult | null> {
    if (!this.gitAvailable) return null;
    try {
      const onAuth = async (url: string) => {
        const cached = this._credentials.get(url);
        if (cached) return cached;
        if (onAuthRequest) {
          const creds = await onAuthRequest(url);
          if (!creds) return { cancel: true };
          this._credentials.set(url, creds);
          return creds;
        }
        const username = prompt(`Git username for ${url}:`) ?? '';
        const password = prompt(`Git password/token for ${url}:`) ?? '';
        this._credentials.set(url, { username, password });
        return { username, password };
      };

      await git.pull({
        fs,
        http,
        dir: repoPath,
        corsProxy: CORS_PROXY,
        onAuth,
        author: { name: 'LinkML Editor', email: 'editor@linkml.io' },
      });
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[gitPull]', repoPath, e);
      return { ok: false, error: msg };
    }
  }

  async gitLog(repoPath: string, limit: number): Promise<GitCommit[]> {
    if (!this.gitAvailable) return [];
    try {
      const commits = await git.log({ fs, dir: repoPath, depth: limit });
      return commits.map((c) => ({
        oid: c.oid,
        message: c.commit.message.trim(),
        author: {
          name: c.commit.author.name,
          email: c.commit.author.email,
          timestamp: c.commit.author.timestamp * 1000,
        },
      }));
    } catch {
      return [];
    }
  }

  // ── Credential storage (localStorage) ──────────────────────────────────────

  async storeCredential(key: string, value: string): Promise<void> {
    localStorage.setItem(`linkml-editor:${key}`, value);
  }

  async getCredential(key: string): Promise<string | null> {
    return localStorage.getItem(`linkml-editor:${key}`);
  }

  async deleteCredential(key: string): Promise<void> {
    localStorage.removeItem(`linkml-editor:${key}`);
  }

  async getSetting(key: string): Promise<string | null> {
    return localStorage.getItem(`linkml-editor-settings:${key}`);
  }

  async setSetting(key: string, value: string): Promise<void> {
    localStorage.setItem(`linkml-editor-settings:${key}`, value);
  }

  async gitClone(url: string, destPath: string, options?: GitCloneOptions): Promise<GitCloneResult> {
    try {
      // Ensure destination directory exists
      await (pfs as unknown as { mkdir: (p: string, opts: { recursive: boolean }) => Promise<void> })
        .mkdir(destPath, { recursive: true }).catch(() => {});

      const onAuth = options?.credentials
        ? (() => {
            const creds = options.credentials!;
            this._credentials.set(url, creds);
            return () => creds;
          })()
        : undefined;

      const onProgress = options?.onProgress
        ? (evt: { phase: string; loaded: number; total: number }) => {
            options.onProgress!(evt.phase, evt.loaded, evt.total);
          }
        : undefined;

      await git.clone({
        fs,
        http,
        dir: destPath,
        url,
        corsProxy: CORS_PROXY,
        singleBranch: true,
        depth: 1,
        ref: options?.branch || undefined,
        onAuth,
        onProgress,
      });

      // Mark git as available now that we have a repo
      this.gitAvailable = true;

      return { ok: true, destPath };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[gitClone]', url, e);
      return { ok: false, destPath, error: friendlyGitError(msg) };
    }
  }
}
