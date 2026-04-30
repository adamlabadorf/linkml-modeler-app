/**
 * NewSchemaDialog — create a blank LinkML schema file in the active project.
 *
 * The user provides a schema name; the dialog derives a safe filename and
 * adds the new file as a dirty, editable schema in the project.
 */
import React from 'react';
import { useAppStore } from '../store/index.js';
import { emptySchema, emptyCanvasLayout } from '../model/index.js';

interface NewSchemaDialogProps {
  onClose: () => void;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'new_schema';
}

export function NewSchemaDialog({ onClose }: NewSchemaDialogProps) {
  const addSchemaFile = useAppStore((s) => s.addSchemaFile);
  const setActiveSchema = useAppStore((s) => s.setActiveSchema);
  const pushToast = useAppStore((s) => s.pushToast);
  const activeProject = useAppStore((s) => s.activeProject);

  const [name, setName] = React.useState('');
  const [error, setError] = React.useState('');

  const trimmedName = name.trim();
  const slug = slugify(trimmedName || 'new_schema');
  const filePath = `${slug}.yaml`;

  const isDuplicate =
    trimmedName.length > 0 &&
    (activeProject?.schemas.some((s) => s.filePath === filePath) ?? false);

  const canCreate = trimmedName.length > 0 && !isDuplicate;

  const handleCreate = () => {
    if (!canCreate) return;

    const schemaId = `https://example.org/${slug}`;
    const schema = emptySchema(slug, schemaId, slug);

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
    pushToast({ message: `Created "${filePath}" — save to write to disk`, severity: 'success', durationMs: 3000 });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 style={styles.title}>New Schema File</h2>

        <div style={styles.section}>
          <label style={styles.label} htmlFor="schema-name-input">Schema Name</label>
          <input
            id="schema-name-input"
            style={styles.input}
            type="text"
            placeholder="my_schema"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            autoFocus
          />

          {trimmedName.length > 0 && (
            <p style={styles.hint}>
              File: <code style={styles.code}>{filePath}</code>
            </p>
          )}

          {isDuplicate && (
            <div style={styles.error}>
              A schema named &quot;{filePath}&quot; already exists in this project.
            </div>
          )}

          {error && <div style={styles.error}>{error}</div>}
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...styles.primaryBtn, ...(!canCreate ? styles.btnDisabled : {}) }}
            onClick={handleCreate}
            disabled={!canCreate}
          >
            Create
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
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '24px',
    width: 400,
    maxWidth: '90vw',
    color: '#e2e8f0',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginTop: 0,
    marginBottom: 16,
    color: '#60a5fa',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  label: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 5,
    padding: '8px 10px',
    fontSize: 12,
    color: '#e2e8f0',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: 11,
    color: '#64748b',
    margin: 0,
  },
  code: {
    color: '#94a3b8',
  },
  error: {
    padding: '8px 10px',
    background: '#450a0a',
    border: '1px solid #7f1d1d',
    borderRadius: 5,
    color: '#fca5a5',
    fontSize: 12,
  },
  footer: {
    marginTop: 20,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelBtn: {
    background: '#334155',
    border: '1px solid #475569',
    color: '#e2e8f0',
    borderRadius: 5,
    padding: '6px 16px',
    fontSize: 12,
    cursor: 'pointer',
  },
  primaryBtn: {
    background: '#2563eb',
    border: '1px solid #3b82f6',
    color: '#fff',
    borderRadius: 5,
    padding: '6px 16px',
    fontSize: 12,
    cursor: 'pointer',
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
};
