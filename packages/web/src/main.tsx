// isomorphic-git requires Buffer to be available as a global in the browser.
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import React, { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

// ── Error Boundary ────────────────────────────────────────────────────────────
interface ErrorBoundaryState { error: Error | null }
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[LinkML Editor] Uncaught error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: '#fca5a5', fontFamily: 'monospace', gap: 16 }}>
          <div style={{ fontSize: 24 }}>⚠ Unexpected Error</div>
          <div style={{ fontSize: 13, color: '#94a3b8', maxWidth: 600, textAlign: 'center' }}>{this.state.error.message}</div>
          <button onClick={() => this.setState({ error: null })} style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 5, padding: '6px 14px', cursor: 'pointer', fontFamily: 'monospace' }}>
            Try to recover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import {
  PlatformContext,
  usePlatform,
  useAppStore,
  serializeYaml,
  PropertiesPanel,
  SchemaSettingsDialog,
  ProjectPanel,
  ValidationPanel,
  FocusModeToolbar,
  MenuBar,
  SplashPage,
  SchemaCanvas,
  CloneDialog,
  ImportSchemaDialog,
  NewSchemaDialog,
  createNewProject,
} from '@linkml-editor/core';
import { WebPlatform } from './platform/WebPlatform.js';
import { GitPanel } from './editor/GitPanel.js';
import { AuthProvider } from './auth/AuthContext.js';
import { SignInPrompt } from './components/SignInPrompt.js';
import { UserMenu } from './components/UserMenu.js';
import { SyncStatusIndicator } from './components/SyncStatusIndicator.js';
import { ProjectSwitcherDialog } from './components/ProjectSwitcherDialog.js';
import { WebProjectRegistry } from './platform/ProjectRegistry.js';

// ── Detect Electron ───────────────────────────────────────────────────────────
const IS_ELECTRON = typeof window !== 'undefined' && 'electronAPI' in window;

// ── Platform selection ────────────────────────────────────────────────────────
async function createPlatform(): Promise<{ platform: import('@linkml-editor/core').PlatformAPI; isCloud: boolean }> {
  let local;
  if (IS_ELECTRON) {
    const { ElectronPlatform } = await import('./platform/ElectronPlatform.js');
    local = new ElectronPlatform();
  } else {
    local = new WebPlatform();
  }

  // Check for stored GitHub token — activate CloudPlatform if present
  const token = await local.getCredential('github-token');
  if (token) {
    const { CloudPlatform } = await import('./platform/CloudPlatform.js');

    // In Electron, resolve the configured clone directory
    let cloneRoot: string | undefined;
    if (IS_ELECTRON) {
      const configuredDir = await local.getSetting('github-clone-dir');
      if (configuredDir) {
        cloneRoot = configuredDir;
      } else {
        // Default: ~/Documents/LinkMLProjects/
        const electronAPI = (window as unknown as { electronAPI?: { getDocumentsPath?(): Promise<string> } }).electronAPI;
        const documents = await electronAPI?.getDocumentsPath?.() ?? '';
        cloneRoot = documents ? `${documents}/LinkMLProjects` : undefined;
      }
    }

    return { platform: new CloudPlatform(local, token, { cloneRoot }), isCloud: true };
  }

  return { platform: local, isCloud: false };
}

// ── YAML Preview panel ────────────────────────────────────────────────────────
function YamlPreview() {
  const schema = useAppStore((s) => s.getActiveSchema());

  const yaml = React.useMemo(() => {
    if (!schema?.schema) return '';
    try {
      return serializeYaml(schema.schema);
    } catch {
      return '# serialization error';
    }
  }, [schema]);

  return (
    <div id="lme-yaml-preview" style={yamlStyles.panel}>
      <div style={yamlStyles.header}>
        <span style={yamlStyles.title}>YAML Preview</span>
        {schema?.isDirty && <span style={yamlStyles.dirty}>● unsaved</span>}
      </div>
      <pre style={yamlStyles.code}>{yaml}</pre>
    </div>
  );
}

const yamlStyles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    width: 300,
    borderLeft: '1px solid #1e293b',
    background: '#060e1a',
    flexShrink: 0,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
  },
  title: {
    fontWeight: 600,
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  dirty: {
    fontSize: 11,
    color: '#f59e0b',
    fontFamily: 'monospace',
  },
  code: {
    flex: 1,
    overflowY: 'auto',
    margin: 0,
    padding: '8px 12px',
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#94a3b8',
    whiteSpace: 'pre',
    lineHeight: 1.5,
  },
};

// ── Toast display ─────────────────────────────────────────────────────────────
function ToastList() {
  const toastQueue = useAppStore((s) => s.toastQueue);
  const dismissToast = useAppStore((s) => s.dismissToast);

  return (
    <div style={toastStyles.container}>
      {toastQueue.map((t) => (
        <div key={t.id} style={{ ...toastStyles.toast, ...toastStyles[t.severity] }}>
          <span>{t.message}</span>
          <button style={toastStyles.dismiss} onClick={() => dismissToast(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

const toastStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    bottom: 32,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 3000,
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 14px',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'monospace',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    pointerEvents: 'auto',
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#e2e8f0',
  },
  info: { background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' },
  success: { background: '#14532d', border: '1px solid #166534', color: '#86efac' },
  warning: { background: '#451a03', border: '1px solid #78350f', color: '#fde68a' },
  error: { background: '#450a0a', border: '1px solid #7f1d1d', color: '#fca5a5' },
  dismiss: {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: 0,
    fontSize: 14,
    opacity: 0.7,
    lineHeight: 1,
  },
};

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const platform = usePlatform();
  const activeProject = useAppStore((s) => s.activeProject);
  const setProject = useAppStore((s) => s.setProject);
  const closeProject = useAppStore((s) => s.closeProject);
  const schemaSettingsOpen = useAppStore((s) => s.schemaSettingsOpen);
  const setSchemaSettingsOpen = useAppStore((s) => s.setSchemaSettingsOpen);
  const schema = useAppStore((s) => s.getActiveSchema());
  const isDirty = useAppStore((s) => s.getIsDirty());
  const commitLog = useAppStore((s) => s.commitLog);
  const gitAvailable = useAppStore((s) => s.gitAvailable);
  const pushToast = useAppStore((s) => s.pushToast);
  const markSchemaDirty = useAppStore((s) => s.markSchemaDirty);
  const yamlPreviewOpen = useAppStore((s) => s.yamlPreviewOpen);
  const validationIssues = useAppStore((s) => s.validationIssues);
  const cloneDialogOpen = useAppStore((s) => s.cloneDialogOpen);
  const setCloneDialogOpen = useAppStore((s) => s.setCloneDialogOpen);
  const importDialogOpen = useAppStore((s) => s.importDialogOpen);
  const setImportDialogOpen = useAppStore((s) => s.setImportDialogOpen);
  const newSchemaDialogOpen = useAppStore((s) => s.newSchemaDialogOpen);
  const setNewSchemaDialogOpen = useAppStore((s) => s.setNewSchemaDialogOpen);
  const switchProjectDialogOpen = useAppStore((s) => s.switchProjectDialogOpen);
  const setSwitchProjectDialogOpen = useAppStore((s) => s.setSwitchProjectDialogOpen);
  const syncStatus = useAppStore((s) => s.syncStatus);

  // Enable "Switch Project" when 2+ projects are registered
  const [registeredProjectCount, setRegisteredProjectCount] = React.useState(() =>
    new WebProjectRegistry().getAll().length
  );
  React.useEffect(() => {
    // Refresh count when the dialog opens or closes so the menu item stays in sync
    setRegisteredProjectCount(new WebProjectRegistry().getAll().length);
  }, [switchProjectDialogOpen]);
  const [isSaving, setIsSaving] = React.useState(false);

  // ── Save project to disk ───────────────────────────────────────────────────
  const saveProject = React.useCallback(async (): Promise<boolean> => {
    const project = useAppStore.getState().activeProject;
    if (!project) return false;

    const dirtySchemas = project.schemas.filter((s) => s.isDirty && !s.isReadOnly);
    if (dirtySchemas.length === 0) {
      pushToast({ message: 'Nothing to save', severity: 'info' });
      return true;
    }

    let rootPath = project.rootPath;

    // If no rootPath (new unsaved project), prompt user to pick a location
    if (!rootPath || rootPath === '/') {
      const picked = await platform.openDirectory();
      if (!picked) return false; // user cancelled
      rootPath = picked;
      // Update project rootPath in store
      useAppStore.setState((state) => ({
        activeProject: state.activeProject
          ? { ...state.activeProject, rootPath: picked }
          : null,
      }));
    }

    setIsSaving(true);
    let savedCount = 0;
    const errors: string[] = [];

    for (const sf of dirtySchemas) {
      try {
        const yaml = serializeYaml(sf.schema);
        const fullPath = rootPath.endsWith('/')
          ? `${rootPath}${sf.filePath}`
          : `${rootPath}/${sf.filePath}`;
        await platform.writeFile(fullPath, yaml);
        markSchemaDirty(sf.id, false);
        savedCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${sf.filePath}: ${msg}`);
      }
    }

    setIsSaving(false);

    if (errors.length > 0) {
      pushToast({
        message: `Save failed for ${errors.length} file(s): ${errors[0]}`,
        severity: 'error',
      });
      return false;
    } else {
      pushToast({
        message: `Saved ${savedCount} file${savedCount > 1 ? 's' : ''}`,
        severity: 'success',
        durationMs: 2000,
      });
      return true;
    }
  }, [platform, pushToast, markSchemaDirty]);

  // ── Git helpers (for MenuBar) ─────────────────────────────────────────────
  const handleMenuCommit = React.useCallback(() => {
    // Open git panel to the changes tab for committing
    useAppStore.getState().setGitPanelOpen(true);
  }, []);

  const handleMenuPush = React.useCallback(() => {
    // Open the git panel — the Push button there has proper credential UI.
    useAppStore.getState().setGitPanelOpen(true);
  }, []);

  const handleMenuPull = React.useCallback(() => {
    // Open the git panel — the Pull button there has proper credential UI.
    useAppStore.getState().setGitPanelOpen(true);
  }, []);

  // ── New Project / Open Project (for MenuBar) ─────────────────────────────
  const handleNewProject = React.useCallback(() => {
    const project = createNewProject('Untitled Schema');
    setProject(project);
  }, [setProject]);

  const handleOpenProject = React.useCallback(() => {
    // Return to the splash page so the user can pick New / Open Folder / Clone / Recent.
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Close project without saving?')) return;
    }
    closeProject();
    useAppStore.getState().setGitAvailable(false);
  }, [isDirty, closeProject]);

  // ── Ctrl+S / Cmd+S keyboard shortcut ───────────────────────────────────────
  React.useEffect(() => {
    function handleSaveShortcut(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProject();
      }
    }
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [saveProject]);

  // Show splash page when no project is loaded
  if (!activeProject) {
    return (
      <div style={styles.app}>
        <SplashPage />
        <SignInPrompt />
        {cloneDialogOpen && (
          <CloneDialog onClose={() => setCloneDialogOpen(false)} />
        )}
        <ToastList />
      </div>
    );
  }

  return (
    <div style={styles.app}>
      {/* Header */}
      <header id="lme-header" style={styles.header}>
        <div style={styles.headerLeft}>
          <span id="lme-logo" style={styles.logo}>⬡ LinkML Visual Schema Editor</span>
          <MenuBar
            onNewProject={handleNewProject}
            onOpenProject={handleOpenProject}
            onSave={saveProject}
            onSaveAs={saveProject}
            onOpenFromUrl={() => setCloneDialogOpen(true)}
            onSwitchProject={registeredProjectCount >= 2 ? () => setSwitchProjectDialogOpen(true) : undefined}
            onNewSchema={() => setNewSchemaDialogOpen(true)}
            onImportSchema={() => setImportDialogOpen(true)}
            onCommit={handleMenuCommit}
            onPush={handleMenuPush}
            onPull={activeProject?.gitConfig?.remoteUrl ? handleMenuPull : undefined}
          />
        </div>
        <div style={styles.headerRight}>
          <SyncStatusIndicator />
          {isDirty && syncStatus === null && <span style={styles.dirtyBadge}>● unsaved changes</span>}
          {isSaving && <span style={styles.savingBadge}>saving…</span>}
          <UserMenu />
        </div>
      </header>

      {/* Sign-in banner (unauthenticated) */}
      <SignInPrompt />

      {/* Main layout */}
      <div style={styles.main}>
        {/* Project panel (left) */}
        <ProjectPanel />

        {/* Canvas + focus toolbar (center) */}
        <div style={styles.canvasColumn}>
          <FocusModeToolbar />
          <div id="lme-canvas-area" style={styles.canvasArea}>
            <SchemaCanvas />
          </div>
        </div>

        {/* Properties panel (right) */}
        <PropertiesPanel />

        {/* YAML preview (far right) */}
        {yamlPreviewOpen && <YamlPreview />}
      </div>

      {/* Bottom panels */}
      <ValidationPanel />
      <GitPanel onSaveBeforeCommit={saveProject} />

      {/* Status bar */}
      <footer id="lme-footer" style={styles.footer}>
        <span>
          {schema
            ? `${schema.filePath} · ${Object.keys(schema.schema.classes).length} class(es) · ${Object.keys(schema.schema.enums).length} enum(s)`
            : 'No schema loaded'}
          {validationIssues.length > 0 && (
            <>
              {' · '}
              <span style={{ color: validationIssues.some(i => i.severity === 'error') ? '#fca5a5' : '#fde68a' }}>
                {validationIssues.filter(i => i.severity === 'error').length > 0
                  ? `${validationIssues.filter(i => i.severity === 'error').length} err`
                  : ''}
                {validationIssues.filter(i => i.severity === 'error').length > 0 && validationIssues.filter(i => i.severity === 'warning').length > 0 ? ', ' : ''}
                {validationIssues.filter(i => i.severity === 'warning').length > 0
                  ? `${validationIssues.filter(i => i.severity === 'warning').length} warn`
                  : ''}
              </span>
            </>
          )}
          {gitAvailable && commitLog.length > 0 && (
            <>
              {' · '}
              <span style={{ color: '#475569' }}>
                {commitLog[0].oid.slice(0, 7)} {commitLog[0].message.split('\n')[0].slice(0, 50)}
              </span>
            </>
          )}
        </span>
        <span>
          Click node to edit · Right-click canvas to add · Drag handle-to-handle for is_a · Del to delete · Ctrl+S save · Ctrl+Z/Y undo/redo · F fit view
        </span>
      </footer>

      {/* Schema settings dialog */}
      {schemaSettingsOpen && (
        <SchemaSettingsDialog onClose={() => setSchemaSettingsOpen(false)} />
      )}

      {/* Clone from URL dialog */}
      {cloneDialogOpen && (
        <CloneDialog onClose={() => setCloneDialogOpen(false)} />
      )}

      {/* Import schema dialog */}
      {importDialogOpen && (
        <ImportSchemaDialog onClose={() => setImportDialogOpen(false)} />
      )}

      {/* New schema dialog */}
      {newSchemaDialogOpen && (
        <NewSchemaDialog onClose={() => setNewSchemaDialogOpen(false)} />
      )}

      {/* Project switcher dialog */}
      {switchProjectDialogOpen && (
        <ProjectSwitcherDialog onClose={() => setSwitchProjectDialogOpen(false)} />
      )}

      {/* Toast notifications */}
      <ToastList />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: 'monospace',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    borderBottom: '1px solid #1e293b',
    background: '#0f172a',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    fontWeight: 700,
    fontSize: 15,
    color: '#60a5fa',
  },
  dirtyBadge: {
    fontSize: 11,
    color: '#f59e0b',
  },
  savingBadge: {
    fontSize: 11,
    color: '#60a5fa',
    fontFamily: 'monospace',
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    minHeight: 0,
  },
  canvasColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
  canvasArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 0,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 16px',
    borderTop: '1px solid #1e293b',
    fontSize: 10,
    color: '#334155',
    background: '#0f172a',
    flexShrink: 0,
  },
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  const { platform, isCloud } = await createPlatform();
  const container = document.getElementById('root')!;
  const root = createRoot(container);

  // Wire up sync status and beforeunload for CloudPlatform
  if (isCloud) {
    const { CloudPlatform } = await import('./platform/CloudPlatform.js');
    if (platform instanceof CloudPlatform) {
      const cloudPlatform = platform;

      // Propagate sync status into the Zustand store
      cloudPlatform.onSyncStatus((status) => {
        const { setSyncStatus, pushToast } = useAppStore.getState();
        setSyncStatus(status);
        if (status === 'error') {
          pushToast({ message: 'Sync failed — another session may have modified this project. Please refresh.', severity: 'error' });
        }
      });

      // Final push on page unload
      window.addEventListener('beforeunload', () => {
        void cloudPlatform.flushSync();
      });
    }
  }

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <PlatformContext.Provider value={platform}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </PlatformContext.Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

bootstrap();
