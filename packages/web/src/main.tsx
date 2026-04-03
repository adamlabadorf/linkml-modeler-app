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
} from '@linkml-editor/core';
import { WebPlatform } from './platform/WebPlatform.js';
import { GitPanel } from './editor/GitPanel.js';

// ── Detect Electron ───────────────────────────────────────────────────────────
const IS_ELECTRON = typeof window !== 'undefined' && 'electronAPI' in window;

// ── Platform selection ────────────────────────────────────────────────────────
async function createPlatform() {
  if (IS_ELECTRON) {
    const { ElectronPlatform } = await import('./platform/ElectronPlatform.js');
    return new ElectronPlatform();
  }
  return new WebPlatform();
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
    <div style={yamlStyles.panel}>
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
  const schemaSettingsOpen = useAppStore((s) => s.schemaSettingsOpen);
  const setSchemaSettingsOpen = useAppStore((s) => s.setSchemaSettingsOpen);
  const schema = useAppStore((s) => s.getActiveSchema());
  const isDirty = useAppStore((s) => s.getIsDirty());
  const pushToast = useAppStore((s) => s.pushToast);
  const markSchemaDirty = useAppStore((s) => s.markSchemaDirty);
  const yamlPreviewOpen = useAppStore((s) => s.yamlPreviewOpen);
  const validationIssues = useAppStore((s) => s.validationIssues);
  const [isSaving, setIsSaving] = React.useState(false);

  // ── Save project to disk ───────────────────────────────────────────────────
  const saveProject = React.useCallback(async () => {
    const project = useAppStore.getState().activeProject;
    if (!project) return;

    const dirtySchemas = project.schemas.filter((s) => s.isDirty && !s.isReadOnly);
    if (dirtySchemas.length === 0) {
      pushToast({ message: 'Nothing to save', severity: 'info' });
      return;
    }

    let rootPath = project.rootPath;

    // If no rootPath (new unsaved project), prompt user to pick a location
    if (!rootPath || rootPath === '/') {
      const picked = await platform.openDirectory();
      if (!picked) return; // user cancelled
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
    } else {
      pushToast({
        message: `Saved ${savedCount} file${savedCount > 1 ? 's' : ''}`,
        severity: 'success',
        durationMs: 2000,
      });
    }
  }, [platform, pushToast, markSchemaDirty]);

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
        <ToastList />
      </div>
    );
  }

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>⬡ LinkML Visual Schema Editor</span>
          <MenuBar
            onSave={saveProject}
            onSaveAs={saveProject}
          />
        </div>
        <div style={styles.headerRight}>
          {isDirty && <span style={styles.dirtyBadge}>● unsaved changes</span>}
          {isSaving && <span style={styles.savingBadge}>saving…</span>}
        </div>
      </header>

      {/* Main layout */}
      <div style={styles.main}>
        {/* Project panel (left) */}
        <ProjectPanel />

        {/* Canvas + focus toolbar (center) */}
        <div style={styles.canvasColumn}>
          <FocusModeToolbar />
          <div style={styles.canvasArea}>
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
      <GitPanel />

      {/* Status bar */}
      <footer style={styles.footer}>
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
        </span>
        <span>
          Click node to edit · Right-click canvas to add · Drag handle-to-handle for is_a · Del to delete · Ctrl+S save · Ctrl+Z/Y undo/redo · F fit view
        </span>
      </footer>

      {/* Schema settings dialog */}
      {schemaSettingsOpen && (
        <SchemaSettingsDialog onClose={() => setSchemaSettingsOpen(false)} />
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
  const platform = await createPlatform();
  const container = document.getElementById('root')!;
  const root = createRoot(container);

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <PlatformContext.Provider value={platform}>
          <App />
        </PlatformContext.Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

bootstrap();
