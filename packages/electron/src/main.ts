/**
 * Electron main process — M7 implementation.
 *
 * - Creates a BrowserWindow loading the web renderer
 * - Registers IPC handlers for PlatformAPI (file I/O + git operations)
 * - Uses isomorphic-git with Node fs for git operations
 * - Credential storage via keytar (falls back to in-memory cache)
 */
import path from 'path';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';

const isDev = process.env.NODE_ENV !== 'production';

// ── Window ────────────────────────────────────────────────────────────────────

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    await win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    await win.loadFile(path.join(__dirname, '../../web/dist/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

// Lazy-loaded heavy Node modules to avoid blocking startup
async function getFs() {
  const { promises } = await import('fs');
  return promises;
}

async function getGit() {
  const git = await import('isomorphic-git');
  return git.default ?? git;
}

async function getHttp() {
  const http = await import('isomorphic-git/http/node');
  return http.default ?? http;
}

// In-memory credential fallback (process lifetime)
const credentialCache = new Map<string, { username: string; password: string }>();

function registerIpcHandlers(): void {
  // ── File System ──────────────────────────────────────────────────────────────

  ipcMain.handle('platform:openFile', async (_event, options?: { accept?: string[] }) => {
    const result = await dialog.showOpenDialog({
      title: 'Open Schema File',
      filters: options?.accept
        ? [{ name: 'Schema Files', extensions: options.accept.map((e) => e.replace('.', '')) }]
        : [{ name: 'YAML', extensions: ['yaml', 'yml'] }, { name: 'All Files', extensions: ['*'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const fs = await getFs();
    const content = await fs.readFile(result.filePaths[0], 'utf8');
    return { path: result.filePaths[0], content };
  });

  ipcMain.handle('platform:saveFile', async (_event, options: { suggestedName?: string; accept?: string[] }, content: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: options.suggestedName,
      filters: options.accept
        ? [{ name: 'Schema Files', extensions: options.accept.map((e) => e.replace('.', '')) }]
        : [{ name: 'YAML', extensions: ['yaml', 'yml'] }],
    });
    if (result.canceled || !result.filePath) return null;
    const fs = await getFs();
    await fs.writeFile(result.filePath, content, 'utf8');
    return result.filePath;
  });

  ipcMain.handle('platform:openDirectory', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open Project Directory',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('platform:readFile', async (_event, filePath: string) => {
    const fs = await getFs();
    return fs.readFile(filePath, 'utf8');
  });

  ipcMain.handle('platform:writeFile', async (_event, filePath: string, content: string) => {
    const fs = await getFs();
    const { mkdir } = await import('fs/promises');
    const pathModule = await import('path');
    await mkdir(pathModule.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  });

  ipcMain.handle('platform:listDirectory', async (_event, dirPath: string) => {
    const fs = await getFs();
    const pathModule = await import('path');
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      path: pathModule.join(dirPath, e.name),
      isDirectory: e.isDirectory(),
    }));
  });

  // ── Git ──────────────────────────────────────────────────────────────────────

  ipcMain.handle('platform:gitAvailable', async (_event, repoPath: string) => {
    try {
      const fs = await getFs();
      const git = await getGit();
      await (git as { resolveRef: (opts: object) => Promise<string> }).resolveRef({ fs: { promises: fs }, dir: repoPath, ref: 'HEAD' });
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('platform:gitStatus', async (_event, repoPath: string) => {
    try {
      const fs = await getFs();
      const git = await getGit();
      const g = git as {
        currentBranch: (opts: object) => Promise<string | undefined>;
        statusMatrix: (opts: object) => Promise<[string, number, number, number][]>;
      };

      const branch = await g.currentBranch({ fs: { promises: fs }, dir: repoPath }) ?? 'HEAD';
      const matrix = await g.statusMatrix({ fs: { promises: fs }, dir: repoPath });

      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      for (const [filepath, headStatus, workdirStatus, stageStatus] of matrix) {
        if (headStatus === 0 && workdirStatus === 2 && stageStatus === 0) {
          untracked.push(filepath);
        } else if (stageStatus !== headStatus && stageStatus !== 0) {
          staged.push(filepath);
        } else if (workdirStatus !== headStatus) {
          unstaged.push(filepath);
        }
      }

      return { branch, aheadCount: 0, behindCount: 0, stagedFiles: staged, unstagedFiles: unstaged, untrackedFiles: untracked };
    } catch {
      return null;
    }
  });

  ipcMain.handle('platform:gitStage', async (_event, repoPath: string, paths: string[]) => {
    const fs = await getFs();
    const git = await getGit();
    const g = git as {
      add: (opts: object) => Promise<void>;
      remove: (opts: object) => Promise<void>;
    };
    for (const p of paths) {
      await g.add({ fs: { promises: fs }, dir: repoPath, filepath: p }).catch(() =>
        g.remove({ fs: { promises: fs }, dir: repoPath, filepath: p }).catch(() => {})
      );
    }
  });

  ipcMain.handle('platform:gitCommit', async (_event, repoPath: string, message: string) => {
    try {
      const fs = await getFs();
      const git = await getGit();
      const g = git as {
        getConfig: (opts: object) => Promise<string | undefined>;
        commit: (opts: object) => Promise<string>;
      };

      let authorName = 'LinkML Editor';
      let authorEmail = 'editor@linkml.io';
      try {
        authorName = await g.getConfig({ fs: { promises: fs }, dir: repoPath, path: 'user.name' }) ?? authorName;
        authorEmail = await g.getConfig({ fs: { promises: fs }, dir: repoPath, path: 'user.email' }) ?? authorEmail;
      } catch { /* use defaults */ }

      return await g.commit({
        fs: { promises: fs },
        dir: repoPath,
        message,
        author: { name: authorName, email: authorEmail },
      });
    } catch {
      return null;
    }
  });

  ipcMain.handle('platform:gitPush', async (_event, repoPath: string) => {
    try {
      const fs = await getFs();
      const git = await getGit();
      const httpModule = await getHttp();
      const g = git as unknown as {
        getConfig: (opts: object) => Promise<string | undefined>;
        push: (opts: object) => Promise<void>;
      };

      const remoteUrl = await g.getConfig({
        fs: { promises: fs }, dir: repoPath, path: 'remote.origin.url',
      }) ?? '';

      let creds = credentialCache.get(remoteUrl);

      if (!creds) {
        // Try keytar
        try {
          const keytar = await import('keytar').catch(() => null);
          if (keytar) {
            const username = await keytar.findPassword(`linkml-editor:username:${remoteUrl}`) ?? undefined;
            const password = await keytar.findPassword(`linkml-editor:${remoteUrl}`) ?? undefined;
            if (username && password) {
              creds = { username, password };
              credentialCache.set(remoteUrl, creds);
            }
          }
        } catch { /* keytar unavailable */ }
      }

      await g.push({
        fs: { promises: fs },
        http: httpModule,
        dir: repoPath,
        onAuth: () => creds ?? { username: '', password: '' },
      });
      return { ok: true };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('platform:gitLog', async (_event, repoPath: string, limit: number) => {
    try {
      const fs = await getFs();
      const git = await getGit();
      const g = git as {
        log: (opts: object) => Promise<Array<{ oid: string; commit: { message: string; author: { name: string; email: string; timestamp: number } } }>>;
      };

      const commits = await g.log({ fs: { promises: fs }, dir: repoPath, depth: limit });
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
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
