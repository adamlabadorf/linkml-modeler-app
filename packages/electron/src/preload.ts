/**
 * Electron preload script.
 *
 * Exposes a typed `electronAPI` via contextBridge so the renderer can call
 * main-process IPC handlers without nodeIntegration.
 */
import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  openFile: (options?: { accept?: string[] }) =>
    ipcRenderer.invoke('platform:openFile', options),

  saveFile: (options: { suggestedName?: string; accept?: string[] }, content: string) =>
    ipcRenderer.invoke('platform:saveFile', options, content),

  openDirectory: () =>
    ipcRenderer.invoke('platform:openDirectory'),

  readFile: (filePath: string) =>
    ipcRenderer.invoke('platform:readFile', filePath),

  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('platform:writeFile', filePath, content),

  listDirectory: (dirPath: string) =>
    ipcRenderer.invoke('platform:listDirectory', dirPath),

  gitAvailable: (repoPath: string) =>
    ipcRenderer.invoke('platform:gitAvailable', repoPath),

  gitStatus: (repoPath: string) =>
    ipcRenderer.invoke('platform:gitStatus', repoPath),

  gitStage: (repoPath: string, paths: string[]) =>
    ipcRenderer.invoke('platform:gitStage', repoPath, paths),

  gitCommit: (repoPath: string, message: string) =>
    ipcRenderer.invoke('platform:gitCommit', repoPath, message),

  gitPush: (repoPath: string) =>
    ipcRenderer.invoke('platform:gitPush', repoPath),

  gitLog: (repoPath: string, limit: number) =>
    ipcRenderer.invoke('platform:gitLog', repoPath, limit),

  gitClone: (url: string, destPath: string, options?: { branch?: string; credentials?: { username: string; password: string } }) =>
    ipcRenderer.invoke('platform:gitClone', url, destPath, options),

  storeCredential: (key: string, value: string) =>
    ipcRenderer.invoke('credential:store', key, value),

  getCredential: (key: string) =>
    ipcRenderer.invoke('credential:get', key),

  deleteCredential: (key: string) =>
    ipcRenderer.invoke('credential:delete', key),

  getSetting: (key: string) =>
    ipcRenderer.invoke('settings:get', key),

  setSetting: (key: string, value: string) =>
    ipcRenderer.invoke('settings:set', key, value),

  openExternal: (url: string) =>
    ipcRenderer.invoke('shell:openExternal', url),

  getDocumentsPath: (): Promise<string> =>
    ipcRenderer.invoke('app:getDocumentsPath'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
