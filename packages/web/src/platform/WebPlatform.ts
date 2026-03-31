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
} from '@linkml-editor/core';

// ── LightningFS singleton (OPFS-backed) ───────────────────────────────────────
const fs = new LightningFS('linkml-editor-fs');
const pfs = fs.promises;

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

  async gitCommit(repoPath: string, message: string): Promise<string | null> {
    if (!this.gitAvailable) return null;
    try {
      const oid = await git.commit({
        fs,
        dir: repoPath,
        message,
        author: { name: 'LinkML Editor', email: 'editor@linkml.io' },
      });
      return oid;
    } catch (e) {
      console.error('[WebPlatform.gitCommit]', e);
      return null;
    }
  }

  async gitPush(repoPath: string): Promise<GitPushResult | null> {
    if (!this.gitAvailable) return null;
    try {
      const onAuth = async (url: string) => {
        const cached = this._credentials.get(url);
        if (cached) return cached;
        // Prompt for credentials
        const username = prompt(`Git username for ${url}:`) ?? '';
        const password = prompt(`Git password/token for ${url}:`) ?? '';
        this._credentials.set(url, { username, password });
        return { username, password };
      };

      await git.push({
        fs,
        http,
        dir: repoPath,
        onAuth,
      });
      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
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
}
