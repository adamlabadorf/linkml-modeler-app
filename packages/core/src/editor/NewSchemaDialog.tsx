/**
 * NewSchemaDialog — create a blank LinkML schema file in the active project.
 *
 * The user provides a schema name; the dialog derives a safe filename and
 * adds the new file as a dirty, editable schema in the project.
 */
import React from 'react';
import { useAppStore } from '../store/index.js';
import { emptySchema, emptyCanvasLayout } from '../model/index.js';
import { Button } from '../ui/Button.js';
import { Dialog } from '../ui/Dialog.js';

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

  return (
    <Dialog
      open
      onClose={onClose}
      title="New Schema File"
      size="sm"
      bodyStyle={{ padding: '20px 24px' }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} disabled={!canCreate}>Create</Button>
        </>
      }
    >
      <div style={styles.section}>
        <label style={styles.label} htmlFor="schema-name-input">Schema Name</label>
        <input
          id="schema-name-input"
          style={styles.input}
          type="text"
          placeholder="my_schema"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
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
    </Dialog>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
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
    color: 'var(--color-fg-primary)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: 11,
    color: 'var(--color-fg-muted)',
    margin: 0,
  },
  code: {
    color: 'var(--color-fg-secondary)',
  },
  error: {
    padding: '8px 10px',
    background: 'var(--color-state-error-bg)',
    border: '1px solid var(--color-state-error-border)',
    borderRadius: 5,
    color: 'var(--color-state-error-fg)',
    fontSize: 12,
  },
};
