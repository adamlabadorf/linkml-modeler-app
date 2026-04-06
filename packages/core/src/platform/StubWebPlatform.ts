/**
 * Stub web platform implementation.
 *
 * Full implementation (File System Access API + isomorphic-git) lives in
 * packages/web. This stub satisfies the PlatformAPI interface for unit
 * testing and early integration work.
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
  GitCloneOptions,
  GitCloneResult,
} from './PlatformContext.js';

export class StubWebPlatform implements PlatformAPI {
  readonly platform = 'web' as const;
  readonly gitAvailable = false;

  async openFile(_options?: OpenFileOptions): Promise<FileResult | null> {
    return null;
  }

  async saveFile(_options: SaveFileOptions, _content: string): Promise<string | null> {
    return null;
  }

  async openDirectory(): Promise<string | null> {
    return null;
  }

  async readFile(_path: string): Promise<string> {
    throw new Error('StubWebPlatform: readFile not implemented');
  }

  async writeFile(_path: string, _content: string): Promise<void> {
    // no-op
  }

  async listDirectory(_path: string): Promise<DirEntry[]> {
    return [];
  }

  async gitStatus(_repoPath: string): Promise<GitStatus | null> {
    return null;
  }

  async gitStage(_repoPath: string, _paths: string[]): Promise<void> {
    // no-op
  }

  async gitCommit(_repoPath: string, _message: string): Promise<string | null> {
    return null;
  }

  async gitPush(_repoPath: string, _onAuth?: (url: string) => Promise<{ username: string; password: string } | null>): Promise<GitPushResult | null> {
    return null;
  }

  async gitPull(_repoPath: string, _onAuth?: (url: string) => Promise<{ username: string; password: string } | null>): Promise<GitPushResult | null> {
    return null;
  }

  async gitLog(_repoPath: string, _limit: number): Promise<GitCommit[]> {
    return [];
  }

  async gitClone(_url: string, destPath: string, _options?: GitCloneOptions): Promise<GitCloneResult> {
    return { ok: false, destPath, error: 'StubWebPlatform: gitClone not implemented' };
  }

  async storeCredential(_key: string, _value: string): Promise<void> {
    // no-op in stub
  }

  async getCredential(_key: string): Promise<string | null> {
    return null;
  }

  async deleteCredential(_key: string): Promise<void> {
    // no-op in stub
  }

  async getSetting(_key: string): Promise<string | null> {
    return null;
  }

  async setSetting(_key: string, _value: string): Promise<void> {
    // no-op in stub
  }
}
