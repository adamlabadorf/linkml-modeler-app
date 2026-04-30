/**
 * ImportSchemaDialog — import a LinkML schema file into the active project.
 *
 * Supports two import modes:
 *   1. From local filesystem — uses PlatformAPI.openFile()
 *   2. From a public URL — fetches content, then either copies locally or
 *      keeps the URL as a read-only reference.
 */
import React from 'react';
import { usePlatform } from '../platform/PlatformContext.js';
import { useAppStore } from '../store/index.js';
import { parseYaml } from '../io/yaml.js';
import { emptyCanvasLayout } from '../model/index.js';

interface ImportSchemaDialogProps {
  onClose: () => void;
}

type ImportMode = 'file' | 'url';

function deriveFilenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? 'imported-schema';
    return last.endsWith('.yaml') || last.endsWith('.yml') ? last : `${last}.yaml`;
  } catch {
    return 'imported-schema.yaml';
  }
}

function deriveFilenameFromPath(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/');
  return segments[segments.length - 1] ?? 'imported-schema.yaml';
}

export function ImportSchemaDialog({ onClose }: ImportSchemaDialogProps) {
  const platform = usePlatform();
  const addSchemaFile = useAppStore((s) => s.addSchemaFile);
  const setActiveSchema = useAppStore((s) => s.setActiveSchema);
  const pushToast = useAppStore((s) => s.pushToast);
  const activeProject = useAppStore((s) => s.activeProject);

  const [mode, setMode] = React.useState<ImportMode>('file');
  const [urlValue, setUrlValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  const isValidUrl = /^https?:\/\/.+/.test(urlValue.trim());

  const checkDuplicateFilePath = (filePath: string): boolean => {
    return activeProject?.schemas.some((s) => s.filePath === filePath) ?? false;
  };

  const handleFileImport = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await platform.openFile({
        accept: ['.yaml', '.yml'],
        title: 'Import Schema File',
      });
      if (!result) {
        setLoading(false);
        return; // user cancelled
      }

      const schema = parseYaml(result.content);
      const filePath = deriveFilenameFromPath(result.path);

      if (checkDuplicateFilePath(filePath)) {
        setError(`A schema named "${filePath}" is already in the project.`);
        setLoading(false);
        return;
      }

      const file = {
        id: crypto.randomUUID(),
        filePath,
        schema,
        isDirty: true,
        canvasLayout: emptyCanvasLayout(),
        isReadOnly: false,
      };

      addSchemaFile(file);
      setActiveSchema(file.id);
      pushToast({ message: `Imported "${filePath}"`, severity: 'success', durationMs: 3000 });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import schema');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlImport = async () => {
    if (!isValidUrl) return;
    setError('');
    setLoading(true);
    try {
      const response = await fetch(urlValue.trim());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const content = await response.text();
      const schema = parseYaml(content);
      const filePath = deriveFilenameFromUrl(urlValue.trim());

      if (checkDuplicateFilePath(filePath)) {
        setError(`A schema named "${filePath}" is already in the project.`);
        setLoading(false);
        return;
      }

      const file = {
        id: crypto.randomUUID(),
        filePath,
        schema,
        isDirty: true,
        canvasLayout: emptyCanvasLayout(),
        isReadOnly: false,
        sourceUrl: urlValue.trim(),
      };

      addSchemaFile(file);
      setActiveSchema(file.id);
      pushToast({
        message: `Imported "${filePath}" — save to write to disk`,
        severity: 'success',
        durationMs: 3000,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schema from URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>Import Schema</h2>

        {/* Mode tabs */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(mode === 'file' ? styles.tabActive : {}) }}
            onClick={() => { setMode('file'); setError(''); }}
          >
            From File
          </button>
          <button
            style={{ ...styles.tab, ...(mode === 'url' ? styles.tabActive : {}) }}
            onClick={() => { setMode('url'); setError(''); }}
          >
            From URL
          </button>
        </div>

        {/* File mode */}
        {mode === 'file' && (
          <div style={styles.section}>
            <p style={styles.hint}>
              Select a local YAML file containing a LinkML schema. It will be added to the current
              project as an editable schema file.
            </p>
            <button style={styles.primaryBtn} onClick={handleFileImport} disabled={loading}>
              {loading ? 'Importing…' : 'Browse…'}
            </button>
          </div>
        )}

        {/* URL mode */}
        {mode === 'url' && (
          <div style={styles.section}>
            <label style={styles.label}>Schema URL</label>
            <input
              style={styles.input}
              type="url"
              placeholder="https://example.org/my-schema.yaml"
              value={urlValue}
              onChange={(e) => { setUrlValue(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && isValidUrl) handleUrlImport(); }}
              autoFocus
            />

            <p style={styles.hint}>
              The schema will be fetched and copied into the project as an editable file.
            </p>

            <button
              style={{ ...styles.primaryBtn, ...((!isValidUrl || loading) ? styles.btnDisabled : {}) }}
              onClick={handleUrlImport}
              disabled={!isValidUrl || loading}
            >
              {loading ? 'Fetching…' : 'Import'}
            </button>
          </div>
        )}

        {/* Error */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
  },
  dialog: {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 8,
    padding: '24px',
    width: 440,
    maxWidth: '90vw',
    color: 'var(--color-fg-primary)',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginTop: 0,
    marginBottom: 16,
    color: 'var(--color-accent-hover)',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 16,
    borderBottom: '1px solid var(--color-border-default)',
    paddingBottom: 8,
  },
  tab: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-fg-muted)',
    padding: '4px 12px',
    fontSize: 12,
    cursor: 'pointer',
    borderRadius: 4,
  },
  tabActive: {
    background: 'var(--color-border-default)',
    color: 'var(--color-fg-primary)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  hint: {
    fontSize: 12,
    color: 'var(--color-fg-secondary)',
    margin: 0,
    lineHeight: 1.5,
  },
  label: {
    fontSize: 11,
    color: 'var(--color-fg-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    background: 'var(--color-bg-canvas)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 5,
    padding: '8px 10px',
    fontSize: 12,
    fontFamily: 'var(--font-family-mono)',
    color: 'var(--color-fg-primary)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  primaryBtn: {
    background: 'var(--color-accent-active)',
    border: '1px solid var(--color-border-focus)',
    color: '#fff',
    borderRadius: 5,
    padding: '8px 16px',
    fontSize: 12,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
  error: {
    marginTop: 12,
    padding: '8px 10px',
    background: 'var(--color-state-error-bg)',
    border: '1px solid var(--color-state-error-border)',
    borderRadius: 5,
    color: 'var(--color-state-error-fg)',
    fontSize: 12,
  },
  footer: {
    marginTop: 20,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    background: 'var(--color-border-default)',
    border: '1px solid var(--color-border-strong)',
    color: 'var(--color-fg-primary)',
    borderRadius: 5,
    padding: '6px 16px',
    fontSize: 12,
    cursor: 'pointer',
  },
};
