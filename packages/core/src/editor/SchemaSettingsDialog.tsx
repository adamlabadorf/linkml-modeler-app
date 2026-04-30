/**
 * SchemaSettingsDialog — modal for editing schema identity, prefixes, and imports.
 */
import React, { useState } from 'react';
import { useAppStore } from '../store/index.js';
import { Button } from '../ui/Button.js';
import { Dialog } from '../ui/Dialog.js';

interface Props {
  onClose: () => void;
}

export function SchemaSettingsDialog({ onClose }: Props) {
  const schemaFile = useAppStore((s) => s.getActiveSchema());
  const updateSchema = useAppStore((s) => s.updateSchema);

  const schema = schemaFile?.schema;
  const schemaId = schemaFile?.id ?? '';

  const [id, setId] = useState(schema?.id ?? '');
  const [name, setName] = useState(schema?.name ?? '');
  const [description, setDescription] = useState(schema?.description ?? '');
  const [license, setLicense] = useState(schema?.license ?? '');
  const [defaultPrefix, setDefaultPrefix] = useState(schema?.defaultPrefix ?? '');
  const [defaultRange, setDefaultRange] = useState(schema?.defaultRange ?? '');

  const [prefixRows, setPrefixRows] = useState<[string, string][]>(
    Object.entries(schema?.prefixes ?? {})
  );

  const [imports, setImports] = useState<string[]>(schema?.imports ?? []);
  const [newImport, setNewImport] = useState('');
  const [newPrefixKey, setNewPrefixKey] = useState('');
  const [newPrefixUri, setNewPrefixUri] = useState('');

  if (!schema) return null;

  function handleSave() {
    const prefixes: Record<string, string> = {};
    for (const [k, v] of prefixRows) {
      if (k.trim()) prefixes[k.trim()] = v;
    }
    updateSchema(schemaId, {
      id: id.trim() || schema!.id,
      name: name.trim() || schema!.name,
      description: description.trim() || undefined,
      license: license.trim() || undefined,
      defaultPrefix: defaultPrefix.trim() || schema!.defaultPrefix,
      defaultRange: defaultRange.trim() || undefined,
      prefixes,
      imports,
    });
    onClose();
  }

  function updatePrefixRow(index: number, key: string, uri: string) {
    setPrefixRows((rows) => rows.map((r, i) => (i === index ? [key, uri] : r)));
  }

  function deletePrefixRow(index: number) {
    setPrefixRows((rows) => rows.filter((_, i) => i !== index));
  }

  function addPrefixRow() {
    if (!newPrefixKey.trim()) return;
    setPrefixRows((rows) => [...rows, [newPrefixKey.trim(), newPrefixUri.trim()]]);
    setNewPrefixKey('');
    setNewPrefixUri('');
  }

  function deleteImport(idx: number) {
    setImports((arr) => arr.filter((_, i) => i !== idx));
  }

  function addImport() {
    const val = newImport.trim();
    if (!val || imports.includes(val)) return;
    setImports((arr) => [...arr, val]);
    setNewImport('');
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="⚙ Schema Settings"
      size="md"
      bodyStyle={{ padding: 0, paddingBottom: 8 }}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </>
      }
    >
      {/* Identity */}
      <div style={styles.sectionHeader}>Identity</div>

      <SettingsField label="id (URI)">
        <input style={styles.input} value={id} onChange={(e) => setId(e.target.value)} placeholder="https://example.org/my-schema" />
      </SettingsField>

      <SettingsField label="name">
        <input style={styles.inputMono} value={name} onChange={(e) => setName(e.target.value)} />
      </SettingsField>

      <SettingsField label="description">
        <textarea style={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </SettingsField>

      <SettingsField label="license">
        <input style={styles.inputMono} value={license} onChange={(e) => setLicense(e.target.value)} placeholder="CC-BY-4.0" />
      </SettingsField>

      <SettingsField label="default_prefix">
        <input style={styles.inputMono} value={defaultPrefix} onChange={(e) => setDefaultPrefix(e.target.value)} />
      </SettingsField>

      <SettingsField label="default_range">
        <input style={styles.inputMono} value={defaultRange} onChange={(e) => setDefaultRange(e.target.value)} placeholder="string" />
      </SettingsField>

      {/* Prefixes */}
      <div style={styles.sectionHeader}>Prefixes</div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Prefix</th>
            <th style={styles.th}>URI</th>
            <th style={{ ...styles.th, width: 32 }}></th>
          </tr>
        </thead>
        <tbody>
          {prefixRows.map(([k, v], i) => (
            <tr key={i}>
              <td style={styles.td}>
                <input style={styles.tableInput} value={k} onChange={(e) => updatePrefixRow(i, e.target.value, v)} />
              </td>
              <td style={styles.td}>
                <input style={styles.tableInput} value={v} onChange={(e) => updatePrefixRow(i, k, e.target.value)} />
              </td>
              <td style={styles.td}>
                <button style={styles.rowDeleteBtn} onClick={() => deletePrefixRow(i)}>×</button>
              </td>
            </tr>
          ))}
          <tr>
            <td style={styles.td}>
              <input
                style={styles.tableInput}
                placeholder="prefix"
                value={newPrefixKey}
                onChange={(e) => setNewPrefixKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPrefixRow()}
              />
            </td>
            <td style={styles.td}>
              <input
                style={styles.tableInput}
                placeholder="https://…"
                value={newPrefixUri}
                onChange={(e) => setNewPrefixUri(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPrefixRow()}
              />
            </td>
            <td style={styles.td}>
              <button style={styles.addBtn} onClick={addPrefixRow}>+</button>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Imports */}
      <div style={styles.sectionHeader}>Imports</div>

      {imports.map((imp, i) => (
        <div key={i} style={styles.importRow}>
          <span style={styles.importText}>{imp}</span>
          <button style={styles.rowDeleteBtn} onClick={() => deleteImport(i)}>×</button>
        </div>
      ))}

      <div style={styles.addRow}>
        <input
          style={{ ...styles.inputMono, flex: 1 }}
          placeholder="linkml:types or ../other-schema"
          value={newImport}
          onChange={(e) => setNewImport(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addImport()}
        />
        <button style={styles.btnPrimary} onClick={addImport}>+ Add</button>
      </div>
    </Dialog>
  );
}

function SettingsField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={fieldStyles.row}>
      <label style={fieldStyles.label}>{label}</label>
      {children}
    </div>
  );
}

const fieldStyles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    padding: '5px 16px',
  },
  label: {
    fontSize: 10,
    color: 'var(--color-fg-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
};

const styles: Record<string, React.CSSProperties> = {
  sectionHeader: {
    padding: '8px 16px 4px',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--color-border-strong)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    borderBottom: '1px solid var(--color-border-subtle)',
    marginTop: 4,
  },
  input: {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 4,
    color: 'var(--color-fg-primary)',
    fontSize: 12,
    padding: '4px 7px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  inputMono: {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 4,
    color: 'var(--color-fg-primary)',
    fontSize: 12,
    padding: '4px 7px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-family-mono)',
  },
  textarea: {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 4,
    color: 'var(--color-fg-primary)',
    fontSize: 12,
    padding: '4px 7px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    margin: '0 0 4px',
    fontSize: 12,
    fontFamily: 'var(--font-family-mono)',
  },
  th: {
    color: 'var(--color-fg-muted)',
    padding: '4px 8px 4px 16px',
    textAlign: 'left',
    fontSize: 10,
    fontWeight: 600,
    borderBottom: '1px solid var(--color-border-subtle)',
  },
  td: {
    padding: '3px 4px 3px 12px',
    verticalAlign: 'middle',
  },
  tableInput: {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 3,
    color: 'var(--color-fg-primary)',
    fontSize: 11,
    padding: '3px 6px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'var(--font-family-mono)',
  },
  rowDeleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-state-error)',
    cursor: 'pointer',
    fontSize: 16,
    padding: '0 4px',
    lineHeight: 1,
  },
  addBtn: {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    color: 'var(--color-accent-hover)',
    cursor: 'pointer',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 14,
  },
  importRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 16px',
    borderBottom: '1px solid var(--color-border-subtle)',
  },
  importText: {
    flex: 1,
    fontFamily: 'var(--font-family-mono)',
    fontSize: 12,
    color: 'var(--color-state-info-fg)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  addRow: {
    display: 'flex',
    gap: 6,
    padding: '8px 16px',
    alignItems: 'center',
  },
  btnPrimary: {
    background: 'var(--color-accent-active)',
    border: '1px solid var(--color-border-focus)',
    color: '#fff',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
    flexShrink: 0,
  },
};
