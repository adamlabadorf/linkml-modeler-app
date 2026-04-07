/**
 * Electron main process — M7 implementation.
 *
 * - Creates a BrowserWindow loading the web renderer
 * - Registers IPC handlers for PlatformAPI (file I/O + git operations)
 * - Uses isomorphic-git with Node fs for git operations
 * - Credential storage via keytar (falls back to in-memory cache)
 */
import path from 'path';
import { pathToFileURL } from 'url';
import { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } from 'electron';

// Use app.isPackaged (reliable in both dev and packaged builds) rather than
// NODE_ENV, which is not set automatically in packaged Electron apps.
const isDev = !app.isPackaged;

// Register custom protocol as privileged before app is ready.
// This allows ES module scripts and fetch to work correctly,
// avoiding CORS issues that occur with file:// protocol.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// ── MIME types ───────────────────────────────────────────────────────────────
// Windows registry may map .js to text/plain; always set correct Content-Type.
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.webp': 'image/webp',
};

// ── Window ────────────────────────────────────────────────────────────────────

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0f172a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
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
    // Serve web assets via the custom app:// protocol so that
    // ES module scripts and CORS work correctly (file:// blocks these).
    const webDistDir = app.isPackaged
      ? path.join(process.resourcesPath, 'web')
      : path.join(__dirname, '../../web/dist');

    protocol.handle('app', async (request) => {
      let urlPath = decodeURIComponent(new URL(request.url).pathname);
      // Strip leading slash so path.join treats it as relative to webDistDir.
      // On Windows this also avoids /C:/... being treated as an absolute path.
      if (urlPath.startsWith('/')) {
        urlPath = urlPath.slice(1);
      }
      // Default to index.html for root or SPA fallback
      if (urlPath === '' || urlPath === '.' || urlPath === './') {
        urlPath = 'index.html';
      }
      const filePath = path.join(webDistDir, urlPath);
      console.log('[protocol]', request.url, '->', filePath);
      const response = await net.fetch(pathToFileURL(filePath).href);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = MIME_TYPES[ext];
      if (mimeType) {
        const headers = new Headers(response.headers);
        headers.set('Content-Type', mimeType);
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      }
      return response;
    });

    await win.loadURL('app://./index.html');
  }

  // Debug: log load failures and renderer console messages
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[did-fail-load]', { code, desc, url });
  });
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });
  // Open DevTools in packaged builds only when explicitly requested
  // (isDev already opens them above)

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

  ipcMain.handle('platform:gitCreateRepo', async (_event, dirPath: string) => {
    try {
      const fs = await getFs();
      const git = await getGit();
      await (git as { init: (opts: object) => Promise<void> }).init({ fs: { promises: fs }, dir: dirPath, defaultBranch: 'main' });
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('platform:gitSetRemote', async (_event, repoPath: string, url: string) => {
    try {
      const fs = await getFs();
      const git = await getGit();
      const g = git as {
        deleteRemote: (opts: object) => Promise<void>;
        addRemote: (opts: object) => Promise<void>;
      };
      try { await g.deleteRemote({ fs: { promises: fs }, dir: repoPath, remote: 'origin' }); } catch { /* ok */ }
      await g.addRemote({ fs: { promises: fs }, dir: repoPath, remote: 'origin', url });
    } catch (e) {
      console.error('[electron:gitSetRemote]', e);
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

  ipcMain.handle('platform:gitCommit', async (_event, repoPath: string, message: string, author?: { name: string; email: string }) => {
    try {
      const fs = await getFs();
      const git = await getGit();
      const g = git as {
        getConfig: (opts: object) => Promise<string | undefined>;
        commit: (opts: object) => Promise<string>;
      };

      let authorName = author?.name ?? 'LinkML Editor';
      let authorEmail = author?.email ?? 'editor@linkml.io';
      if (!author) {
        try {
          authorName = await g.getConfig({ fs: { promises: fs }, dir: repoPath, path: 'user.name' }) ?? authorName;
          authorEmail = await g.getConfig({ fs: { promises: fs }, dir: repoPath, path: 'user.email' }) ?? authorEmail;
        } catch { /* use defaults */ }
      }

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

  ipcMain.handle('platform:gitPull', async (_event, repoPath: string) => {
    try {
      const fs = await getFs();
      const git = await getGit();
      const httpModule = await getHttp();
      const g = git as unknown as {
        getConfig: (opts: object) => Promise<string | undefined>;
        pull: (opts: object) => Promise<void>;
      };

      const remoteUrl = await g.getConfig({
        fs: { promises: fs }, dir: repoPath, path: 'remote.origin.url',
      }) ?? '';

      let creds = credentialCache.get(remoteUrl);

      if (!creds) {
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

      await g.pull({
        fs: { promises: fs },
        http: httpModule,
        dir: repoPath,
        onAuth: () => creds ?? { username: '', password: '' },
        author: { name: 'LinkML Editor', email: 'editor@linkml.io' },
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

  // ── Credentials (keytar) ─────────────────────────────────────────────────────

  ipcMain.handle('credential:store', async (_event, key: string, value: string) => {
    try {
      const keytar = await import('keytar').catch(() => null);
      if (keytar) {
        await keytar.setPassword('linkml-modeler', key, value);
      }
    } catch { /* keytar unavailable */ }
  });

  ipcMain.handle('credential:get', async (_event, key: string) => {
    try {
      const keytar = await import('keytar').catch(() => null);
      if (keytar) {
        return await keytar.getPassword('linkml-modeler', key);
      }
    } catch { /* keytar unavailable */ }
    return null;
  });

  ipcMain.handle('credential:delete', async (_event, key: string) => {
    try {
      const keytar = await import('keytar').catch(() => null);
      if (keytar) {
        await keytar.deletePassword('linkml-modeler', key);
      }
    } catch { /* keytar unavailable */ }
  });

  // ── Settings (userData JSON file) ────────────────────────────────────────────

  async function readSettingsFile(): Promise<Record<string, string>> {
    try {
      const fs = await getFs();
      const pathModule = await import('path');
      const settingsPath = pathModule.join(app.getPath('userData'), 'settings.json');
      const raw = await fs.readFile(settingsPath, 'utf8');
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }

  async function writeSettingsFile(settings: Record<string, string>): Promise<void> {
    const fs = await getFs();
    const pathModule = await import('path');
    const settingsPath = pathModule.join(app.getPath('userData'), 'settings.json');
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }

  ipcMain.handle('settings:get', async (_event, key: string) => {
    const settings = await readSettingsFile();
    return settings[key] ?? null;
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    const settings = await readSettingsFile();
    settings[key] = value;
    await writeSettingsFile(settings);
  });

  // ── App paths ────────────────────────────────────────────────────────────────

  ipcMain.handle('app:getDocumentsPath', () => {
    return app.getPath('documents');
  });

  // ── Shell ────────────────────────────────────────────────────────────────────

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('platform:gitClone', async (_event, url: string, destPath: string, options?: { branch?: string; credentials?: { username: string; password: string } }) => {
    try {
      const fs = await getFs();
      const git = await getGit();
      const httpModule = await getHttp();
      const { mkdir } = await import('fs/promises');

      await mkdir(destPath, { recursive: true });

      const g = git as unknown as {
        clone: (opts: object) => Promise<void>;
      };

      const cloneOpts: Record<string, unknown> = {
        fs: { promises: fs },
        http: httpModule,
        dir: destPath,
        url,
        singleBranch: true,
        depth: 1,
      };

      if (options?.branch) {
        cloneOpts.ref = options.branch;
      }

      if (options?.credentials) {
        const creds = options.credentials;
        credentialCache.set(url, creds);
        cloneOpts.onAuth = () => creds;
      }

      await g.clone(cloneOpts);

      return { ok: true, destPath };
    } catch (e: unknown) {
      return { ok: false, destPath, error: e instanceof Error ? e.message : String(e) };
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
