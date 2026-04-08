/**
 * CloudPlatform — PlatformAPI adapter that wraps a local platform with GitHub sync.
 *
 * File I/O is delegated to the local platform (WebPlatform or ElectronPlatform).
 * Every writeFile call triggers a debounced auto-commit+push (5 s idle).
 * Credentials (the OAuth token) are also managed via the local platform.
 *
 * Additional cloud methods (not on PlatformAPI):
 *   cloneProject(repoUrl, schemaPath?, persistLayout?)
 *   createProject(repoName, schemaPath?, persistLayout?)
 *   openProject(repoUrl)      — pull + open already-cloned project
 *   listProjects()            — read local project registry
 *   removeProject(repoUrl)    — remove from registry (does not delete local clone)
 *   convertProject(...)       — convert local-only project to GitHub-backed
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
  GitCredentials,
  GitCloneOptions,
  GitCloneResult,
} from '@linkml-editor/core';
import { WebProjectRegistry, type ProjectRegistryEntry } from './ProjectRegistry.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'saved' | 'syncing' | 'unsaved' | 'error';
export type SyncStatusListener = (status: SyncStatus, error?: string) => void;

export interface CloudOpenResult {
  repoPath: string;    // absolute clone path (OPFS key for web)
  schemaPath: string;  // relative schemaPath within clone
  persistLayout: boolean;
  entry: ProjectRegistryEntry;
}

export interface GitHubProjectConfig {
  repoUrl: string;
  schemaPath: string;
  persistLayout: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTO_SYNC_DELAY_MS = 5_000;
const PROJECT_CONFIG_PATH = '.linkml-editor/project.json';
const LAYOUT_PATH = '.linkml-editor/layout.json';
const GITIGNORE_PATH = '.gitignore';
const GITHUB_API = 'https://api.github.com';

// ── CloudPlatform ─────────────────────────────────────────────────────────────

export interface CloudPlatformOptions {
  /**
   * Root directory for local clones.
   * - Web: defaults to OPFS namespace (derived by WebProjectRegistry.opfsPathForRepo)
   * - Electron: defaults to ~/Documents/LinkMLProjects/ (passed in at construction)
   */
  cloneRoot?: string;
}

export class CloudPlatform implements PlatformAPI {
  readonly platform: 'web' | 'electron';
  gitAvailable = true;

  private readonly _registry: WebProjectRegistry;
  private readonly _cloneRoot: string | null;
  private _currentRepoPath: string | null = null;
  private _syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _syncListeners: SyncStatusListener[] = [];
  private _syncStatus: SyncStatus = 'saved';

  constructor(
    private readonly local: PlatformAPI,
    private readonly token: string,
    options: CloudPlatformOptions = {},
  ) {
    this.platform = local.platform;
    this._registry = new WebProjectRegistry();
    this._cloneRoot = options.cloneRoot ?? null;
  }

  /** Resolve the local clone path for a given repoUrl */
  private _clonePathForRepo(repoUrl: string): string {
    if (this._cloneRoot) {
      // Electron: use configured directory + {repo} name
      const parsed = WebProjectRegistry.parseOwnerRepo(repoUrl);
      const repo = parsed?.repo ?? repoUrl.split('/').pop() ?? 'repo';
      return `${this._cloneRoot}/${repo}`;
    }
    // Web: OPFS namespace
    return WebProjectRegistry.opfsPathForRepo(repoUrl);
  }

  // ── Sync status ──────────────────────────────────────────────────────────────

  get syncStatus(): SyncStatus {
    return this._syncStatus;
  }

  onSyncStatus(listener: SyncStatusListener): () => void {
    this._syncListeners.push(listener);
    return () => {
      this._syncListeners = this._syncListeners.filter((l) => l !== listener);
    };
  }

  private _setSyncStatus(status: SyncStatus, error?: string): void {
    this._syncStatus = status;
    for (const l of this._syncListeners) l(status, error);
  }

  // ── Active project ───────────────────────────────────────────────────────────

  setActiveRepoPath(repoPath: string | null): void {
    this._currentRepoPath = repoPath;
  }

  // ── Cloud project methods ────────────────────────────────────────────────────

  listProjects(): ProjectRegistryEntry[] {
    return this._registry.getAll();
  }

  removeProject(repoUrl: string): void {
    this._registry.remove(repoUrl);
  }

  /**
   * Clone a GitHub repo into the OPFS namespace.
   * Writes .linkml-editor/project.json and sets up .gitignore.
   */
  async cloneProject(
    repoUrl: string,
    schemaPath = '.',
    persistLayout = false,
    onProgress?: (phase: string, loaded: number, total: number) => void,
  ): Promise<CloudOpenResult> {
    const clonePath = this._clonePathForRepo(repoUrl);
    const parsed = WebProjectRegistry.parseOwnerRepo(repoUrl);
    const repoName = parsed?.repo ?? repoUrl.split('/').pop() ?? 'repo';

    // Clone (or skip if already present)
    const cloneResult = await this.local.gitClone(repoUrl, clonePath, {
      credentials: { username: 'x-token', password: this.token },
      onProgress,
    });

    if (!cloneResult.ok) {
      console.error('[cloneProject]', repoUrl, cloneResult.error);
      throw new Error(cloneResult.error ?? 'Clone failed: unknown error');
    }

    // Check if .linkml-editor/project.json already exists in the repo
    const configFullPath = `${clonePath}/${PROJECT_CONFIG_PATH}`;
    let existingConfig: GitHubProjectConfig | null = null;
    try {
      const raw = await this.local.readFile(configFullPath);
      existingConfig = JSON.parse(raw) as GitHubProjectConfig;
    } catch {
      // No existing config
    }

    const resolvedSchemaPath = existingConfig?.schemaPath ?? schemaPath;
    const resolvedPersistLayout = existingConfig?.persistLayout ?? persistLayout;

    // Write project.json if not already there
    if (!existingConfig) {
      await this._writeProjectConfig(clonePath, {
        repoUrl,
        schemaPath: resolvedSchemaPath,
        persistLayout: resolvedPersistLayout,
      });

      // Manage .gitignore
      await this._manageGitignore(clonePath, resolvedPersistLayout);

      // Initial commit + push
      await this._commitAndPush(clonePath, 'chore: add .linkml-editor/project.json');
    }

    // Update registry
    const entry: ProjectRegistryEntry = {
      repoUrl,
      repoName,
      schemaPath: resolvedSchemaPath,
      persistLayout: resolvedPersistLayout,
      localPath: clonePath,
      lastOpenedAt: new Date().toISOString(),
    };
    this._registry.addOrUpdate(entry);

    this._currentRepoPath = clonePath;
    this._setSyncStatus('saved');

    return { repoPath: clonePath, schemaPath: resolvedSchemaPath, persistLayout: resolvedPersistLayout, entry };
  }

  /**
   * Create a new private GitHub repo, init clone locally, and write project.json.
   */
  async createProject(
    repoName: string,
    schemaPath = 'schema',
    persistLayout = false,
  ): Promise<CloudOpenResult> {
    // Create the repo on GitHub
    const createRes = await fetch(`${GITHUB_API}/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: repoName, private: true, auto_init: true }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { message?: string };
      throw new Error(`Failed to create GitHub repo: ${err.message ?? createRes.statusText}`);
    }

    const repoData = await createRes.json() as { clone_url: string; html_url: string; name: string };
    const repoUrl = repoData.html_url;
    const cloneUrl = repoData.clone_url;
    const clonePath = this._clonePathForRepo(repoUrl);

    // Clone the freshly created repo (has auto_init commit)
    const cloneResult = await this.local.gitClone(cloneUrl, clonePath, {
      credentials: { username: 'x-token', password: this.token },
    });

    if (!cloneResult.ok) {
      throw new Error(`Clone failed after create: ${cloneResult.error ?? 'unknown'}`);
    }

    // Write project.json
    await this._writeProjectConfig(clonePath, { repoUrl, schemaPath, persistLayout });

    // Manage .gitignore
    await this._manageGitignore(clonePath, persistLayout);

    // Commit + push project metadata
    await this._commitAndPush(clonePath, 'chore: initialize linkml-editor project');

    const entry: ProjectRegistryEntry = {
      repoUrl,
      repoName,
      schemaPath,
      persistLayout,
      localPath: clonePath,
      lastOpenedAt: new Date().toISOString(),
    };
    this._registry.addOrUpdate(entry);

    this._currentRepoPath = clonePath;
    this._setSyncStatus('saved');

    return { repoPath: clonePath, schemaPath, persistLayout, entry };
  }

  /**
   * Open an already-registered project. Pulls latest from remote if possible.
   */
  async openProject(repoUrl: string): Promise<CloudOpenResult> {
    const entry = this._registry.getByRepoUrl(repoUrl);
    if (!entry) {
      throw new Error(`Project not found in registry: ${repoUrl}. Clone it first.`);
    }

    const clonePath = entry.localPath;

    // Pull latest (best-effort)
    try {
      await this._pull(clonePath);
    } catch {
      // Offline or network error — continue with local clone
    }

    // Re-read project.json in case it was updated remotely
    const configFullPath = `${clonePath}/${PROJECT_CONFIG_PATH}`;
    let config: GitHubProjectConfig = {
      repoUrl,
      schemaPath: entry.schemaPath,
      persistLayout: entry.persistLayout,
    };
    try {
      const raw = await this.local.readFile(configFullPath);
      config = JSON.parse(raw) as GitHubProjectConfig;
    } catch {
      // Use registry values
    }

    // Update last opened
    this._registry.addOrUpdate({ ...entry, lastOpenedAt: new Date().toISOString() });

    this._currentRepoPath = clonePath;
    this._setSyncStatus('saved');

    return {
      repoPath: clonePath,
      schemaPath: config.schemaPath,
      persistLayout: config.persistLayout,
      entry: { ...entry, ...config, lastOpenedAt: new Date().toISOString() },
    };
  }

  /**
   * Convert a local-only project to GitHub-backed.
   * Copies YAML files from localRootPath into the new repo at schemaPath.
   */
  async convertProject(
    localRootPath: string,
    repoName: string,
    schemaPath = 'schema',
    persistLayout = false,
    onProgress?: (phase: string, loaded: number, total: number) => void,
  ): Promise<CloudOpenResult> {
    // Create the repo on GitHub
    const createRes = await fetch(`${GITHUB_API}/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: repoName, private: true, auto_init: true }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({})) as { message?: string };
      throw new Error(`Failed to create GitHub repo: ${err.message ?? createRes.statusText}`);
    }

    const repoData = await createRes.json() as { clone_url: string; html_url: string; name: string };
    const repoUrl = repoData.html_url;
    const cloneUrl = repoData.clone_url;
    const clonePath = this._clonePathForRepo(repoUrl);

    // Clone
    const cloneResult = await this.local.gitClone(cloneUrl, clonePath, {
      credentials: { username: 'x-token', password: this.token },
      onProgress,
    });
    if (!cloneResult.ok) {
      throw new Error(`Clone failed: ${cloneResult.error ?? 'unknown'}`);
    }

    // Copy YAML files from local project into clone at schemaPath
    const schemaDirInClone = `${clonePath}/${schemaPath}`;
    await this._mkdirp(schemaDirInClone);

    const localFiles = await this.local.listDirectory(localRootPath);
    for (const f of localFiles) {
      if (!f.isDirectory && (f.name.endsWith('.yaml') || f.name.endsWith('.yml'))) {
        const content = await this.local.readFile(f.path);
        await this.local.writeFile(`${schemaDirInClone}/${f.name}`, content);
      }
    }

    // Write project.json
    await this._writeProjectConfig(clonePath, { repoUrl, schemaPath, persistLayout });

    // Manage .gitignore
    await this._manageGitignore(clonePath, persistLayout);

    // Commit + push
    await this._commitAndPush(clonePath, 'chore: initialize linkml-editor project from local copy');

    const entry: ProjectRegistryEntry = {
      repoUrl,
      repoName,
      schemaPath,
      persistLayout,
      localPath: clonePath,
      lastOpenedAt: new Date().toISOString(),
    };
    this._registry.addOrUpdate(entry);

    this._currentRepoPath = clonePath;
    this._setSyncStatus('saved');

    return { repoPath: clonePath, schemaPath, persistLayout, entry };
  }

  // ── PlatformAPI: File I/O ────────────────────────────────────────────────────

  async openFile(options?: OpenFileOptions): Promise<FileResult | null> {
    return this.local.openFile(options);
  }

  async saveFile(options: SaveFileOptions, content: string): Promise<string | null> {
    return this.local.saveFile(options, content);
  }

  async openDirectory(): Promise<string | null> {
    return this.local.openDirectory();
  }

  async readFile(path: string): Promise<string> {
    return this.local.readFile(path);
  }

  /**
   * Write to local clone and schedule debounced auto-sync.
   */
  async writeFile(path: string, content: string): Promise<void> {
    await this.local.writeFile(path, content);
    this._scheduleSync();
  }

  async listDirectory(path: string): Promise<DirEntry[]> {
    return this.local.listDirectory(path);
  }

  // ── PlatformAPI: Git ─────────────────────────────────────────────────────────

  async initGit(dirPath: string): Promise<boolean> {
    return this.local.initGit(dirPath);
  }

  async gitCreateRepo(dirPath: string): Promise<boolean> {
    return this.local.gitCreateRepo(dirPath);
  }

  async gitSetRemote(repoPath: string, url: string): Promise<void> {
    return this.local.gitSetRemote(repoPath, url);
  }

  async gitReadConfig(repoPath: string): Promise<{ remoteUrl?: string; userName?: string; userEmail?: string }> {
    return this.local.gitReadConfig(repoPath);
  }

  async getProjectsPath(): Promise<string> {
    return this.local.getProjectsPath();
  }

  async gitStatus(repoPath: string): Promise<GitStatus | null> {
    return this.local.gitStatus(repoPath);
  }

  async gitStage(repoPath: string, paths: string[]): Promise<void> {
    return this.local.gitStage(repoPath, paths);
  }

  async gitCommit(repoPath: string, message: string, author?: { name: string; email: string }): Promise<string | null> {
    return this.local.gitCommit(repoPath, message, author);
  }

  async gitPush(
    repoPath: string,
    _onAuth?: (url: string) => Promise<GitCredentials | null>,
  ): Promise<GitPushResult | null> {
    // Always use token auth for cloud platform — ignore caller's onAuth
    return this.local.gitPush(repoPath, async () => ({
      username: 'x-token',
      password: this.token,
    }));
  }

  async gitPull(
    repoPath: string,
    _onAuth?: (url: string) => Promise<GitCredentials | null>,
  ): Promise<GitPushResult | null> {
    // Always use token auth for cloud platform — ignore caller's onAuth
    return this.local.gitPull(repoPath, async () => ({
      username: 'x-token',
      password: this.token,
    }));
  }

  async gitLog(repoPath: string, limit: number): Promise<GitCommit[]> {
    return this.local.gitLog(repoPath, limit);
  }

  async gitCheckout(repoPath: string, paths: string[]): Promise<void> {
    return this.local.gitCheckout(repoPath, paths);
  }

  async gitClone(url: string, destPath: string, options?: GitCloneOptions): Promise<GitCloneResult> {
    // Inject token if no credentials provided
    const opts: GitCloneOptions = {
      ...options,
      credentials: options?.credentials ?? { username: 'x-token', password: this.token },
    };
    return this.local.gitClone(url, destPath, opts);
  }

  // ── PlatformAPI: Credentials / Settings (delegate) ──────────────────────────

  async storeCredential(key: string, value: string): Promise<void> {
    return this.local.storeCredential(key, value);
  }

  async getCredential(key: string): Promise<string | null> {
    return this.local.getCredential(key);
  }

  async deleteCredential(key: string): Promise<void> {
    return this.local.deleteCredential(key);
  }

  async getSetting(key: string): Promise<string | null> {
    return this.local.getSetting(key);
  }

  async setSetting(key: string, value: string): Promise<void> {
    return this.local.setSetting(key, value);
  }

  // ── Auto-sync (debounced) ────────────────────────────────────────────────────

  private _scheduleSync(): void {
    this._setSyncStatus('unsaved');

    if (this._syncDebounceTimer !== null) {
      clearTimeout(this._syncDebounceTimer);
    }

    this._syncDebounceTimer = setTimeout(() => {
      this._syncDebounceTimer = null;
      void this._autoSync();
    }, AUTO_SYNC_DELAY_MS);
  }

  private async _autoSync(): Promise<void> {
    const repoPath = this._currentRepoPath;
    if (!repoPath) return;

    this._setSyncStatus('syncing');
    try {
      await this._commitAndPush(repoPath, 'chore: auto-save schema changes');
      this._setSyncStatus('saved');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this._setSyncStatus('error', msg);
      console.error('[CloudPlatform] Auto-sync failed:', msg);
    }
  }

  /**
   * Flush any pending debounced sync immediately.
   * Called on beforeunload / before-quit.
   */
  async flushSync(): Promise<void> {
    if (this._syncDebounceTimer !== null) {
      clearTimeout(this._syncDebounceTimer);
      this._syncDebounceTimer = null;
    }

    const repoPath = this._currentRepoPath;
    if (!repoPath || this._syncStatus === 'saved') return;

    this._setSyncStatus('syncing');
    try {
      await this._commitAndPush(repoPath, 'chore: auto-save schema changes');
      this._setSyncStatus('saved');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this._setSyncStatus('error', msg);
    }
  }

  // ── Git helpers ──────────────────────────────────────────────────────────────

  private async _commitAndPush(repoPath: string, message: string): Promise<void> {
    // Stage all changed/new files
    const status = await this.local.gitStatus(repoPath);
    if (!status) return;

    const toStage = [
      ...status.stagedFiles,
      ...status.unstagedFiles,
      ...status.untrackedFiles,
    ];

    if (toStage.length === 0 && status.stagedFiles.length === 0) {
      // Nothing to commit
      return;
    }

    if (toStage.length > 0) {
      await this.local.gitStage(repoPath, toStage);
    }

    const oid = await this.local.gitCommit(repoPath, message);
    if (!oid) return;

    const pushResult = await this.local.gitPush(repoPath, async () => ({
      username: 'x-token',
      password: this.token,
    }));

    if (!pushResult?.ok) {
      throw new Error(pushResult?.error ?? 'Push failed');
    }
  }

  private async _pull(repoPath: string): Promise<void> {
    const result = await this.gitPull(repoPath);
    if (result && !result.ok) {
      throw new Error(result.error ?? 'Pull failed');
    }
  }

  private async _writeProjectConfig(repoPath: string, config: GitHubProjectConfig): Promise<void> {
    const configDir = `${repoPath}/.linkml-editor`;
    await this._mkdirp(configDir);
    await this.local.writeFile(`${repoPath}/${PROJECT_CONFIG_PATH}`, JSON.stringify(config, null, 2));
  }

  private async _manageGitignore(repoPath: string, persistLayout: boolean): Promise<void> {
    const gitignorePath = `${repoPath}/${GITIGNORE_PATH}`;

    let existing = '';
    try {
      existing = await this.local.readFile(gitignorePath);
    } catch {
      // No .gitignore yet
    }

    const layoutEntry = LAYOUT_PATH; // .linkml-editor/layout.json

    if (!persistLayout) {
      // Add layout.json to .gitignore if not already there
      if (!existing.includes(layoutEntry)) {
        const separator = existing && !existing.endsWith('\n') ? '\n' : '';
        await this.local.writeFile(
          gitignorePath,
          `${existing}${separator}# LinkML Editor — local-only files\n${layoutEntry}\n`,
        );
      }
    } else {
      // Remove layout.json entry from .gitignore if present
      if (existing.includes(layoutEntry)) {
        const updated = existing
          .split('\n')
          .filter((line) => !line.includes(layoutEntry))
          .join('\n');
        await this.local.writeFile(gitignorePath, updated);
      }
    }
  }

  private async _mkdirp(path: string): Promise<void> {
    // Use writeFile with a sentinel to trigger directory creation,
    // or just attempt to list — if it fails, the local platform will create dirs on write
    try {
      await this.local.listDirectory(path);
    } catch {
      // Directory doesn't exist; local.writeFile creates parent dirs on platforms that support it
      // We write an empty .keep file and immediately remove it via another write — or just let
      // the first writeFile call create the directory implicitly.
    }
  }
}
