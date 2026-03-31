/**
 * ElectronPlatform — renderer-side PlatformAPI implementation.
 *
 * Delegates all I/O and git operations to the main process via IPC,
 * using the `window.electronAPI` bridge exposed by preload.ts.
 */
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

type ElectronBridge = {
  openFile(options?: { accept?: string[] }): Promise<FileResult | null>;
  saveFile(options: { suggestedName?: string; accept?: string[] }, content: string): Promise<string | null>;
  openDirectory(): Promise<string | null>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDirectory(path: string): Promise<DirEntry[]>;
  gitAvailable(repoPath: string): Promise<boolean>;
  gitStatus(repoPath: string): Promise<GitStatus | null>;
  gitStage(repoPath: string, paths: string[]): Promise<void>;
  gitCommit(repoPath: string, message: string): Promise<string | null>;
  gitPush(repoPath: string): Promise<GitPushResult | null>;
  gitLog(repoPath: string, limit: number): Promise<GitCommit[]>;
};

function bridge(): ElectronBridge {
  return (window as unknown as { electronAPI: ElectronBridge }).electronAPI;
}

export class ElectronPlatform implements PlatformAPI {
  readonly platform = 'electron' as const;
  gitAvailable = false;

  async init(repoPath?: string): Promise<void> {
    if (repoPath) {
      this.gitAvailable = await bridge().gitAvailable(repoPath);
    }
  }

  async openFile(options?: OpenFileOptions): Promise<FileResult | null> {
    return bridge().openFile(options);
  }

  async saveFile(options: SaveFileOptions, content: string): Promise<string | null> {
    return bridge().saveFile(options, content);
  }

  async openDirectory(): Promise<string | null> {
    return bridge().openDirectory();
  }

  async readFile(path: string): Promise<string> {
    return bridge().readFile(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    return bridge().writeFile(path, content);
  }

  async listDirectory(path: string): Promise<DirEntry[]> {
    return bridge().listDirectory(path);
  }

  async gitStatus(repoPath: string): Promise<GitStatus | null> {
    return bridge().gitStatus(repoPath);
  }

  async gitStage(repoPath: string, paths: string[]): Promise<void> {
    return bridge().gitStage(repoPath, paths);
  }

  async gitCommit(repoPath: string, message: string): Promise<string | null> {
    return bridge().gitCommit(repoPath, message);
  }

  async gitPush(repoPath: string): Promise<GitPushResult | null> {
    return bridge().gitPush(repoPath);
  }

  async gitLog(repoPath: string, limit: number): Promise<GitCommit[]> {
    return bridge().gitLog(repoPath, limit);
  }
}
