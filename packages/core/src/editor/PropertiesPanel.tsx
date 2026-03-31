/**
 * PropertiesPanel — context-sensitive side panel.
 * Shows fields based on the currently selected entity (class/slot/enum/edge/schema).
 */
import React, { useCallback, useState } from 'react';
import { useAppStore } from '../store/index.js';
import type { ClassDefinition, SlotDefinition, EnumDefinition, PermissibleValue } from '../model/index.js';

// ── Shared field components ───────────────────────────────────────────────────

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.fieldRow}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  monospace,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  monospace?: boolean;
}) {
  return (
    <input
      style={{ ...styles.input, ...(monospace ? styles.inputMono : {}) }}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      style={styles.textarea}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
    />
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={styles.checkboxRow}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        style={styles.checkbox}
      />
      <span>{label}</span>
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <select style={styles.select} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <div style={styles.sectionHeader}>{title}</div>;
}

function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div style={styles.deleteConfirm}>
        <span style={styles.deleteConfirmText}>Delete {label}?</span>
        <button style={styles.btnDanger} onClick={onConfirm}>
          Confirm
        </button>
        <button style={styles.btnGhost} onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button style={styles.btnDanger} onClick={() => setConfirming(true)}>
      Delete {label}
    </button>
  );
}

// ── Panel sections ────────────────────────────────────────────────────────────

function ClassPanel({ schemaId, className }: { schemaId: string; className: string }) {
  const schema = useAppStore((s) => s.getActiveSchema())?.schema;
  const updateClass = useAppStore((s) => s.updateClass);
  const addAttribute = useAppStore((s) => s.addAttribute);
  const updateAttribute = useAppStore((s) => s.updateAttribute);
  const deleteAttribute = useAppStore((s) => s.deleteAttribute);
  const deleteClass = useAppStore((s) => s.deleteClass);
  const setActiveEntity = useAppStore((s) => s.setActiveEntity);

  const classDef = schema?.classes[className] as ClassDefinition | undefined;
  if (!classDef) return <EmptyPanel message="Class not found" />;
  const cls = classDef;

  const allClassNames = Object.keys(schema?.classes ?? {}).filter((n) => n !== className);
  const allEnumNames = Object.keys(schema?.enums ?? {});
  const builtinTypes = ['string', 'integer', 'float', 'boolean', 'date', 'datetime', 'uri', 'uriorcurie'];
  const rangeOptions = [...builtinTypes, ...allClassNames, ...allEnumNames];

  const update = (partial: Partial<ClassDefinition>) => updateClass(schemaId, className, partial);

  const [newSlotName, setNewSlotName] = useState('');

  function handleAddSlot() {
    const name = newSlotName.trim();
    if (!name || cls.attributes[name]) return;
    addAttribute(schemaId, className, { name });
    setNewSlotName('');
  }

  return (
    <div>
      <SectionHeader title="Class Properties" />

      <FieldRow label="Name">
        <TextInput value={classDef.name} onChange={() => {}} placeholder="class name" monospace />
      </FieldRow>

      <FieldRow label="Description">
        <TextArea
          value={classDef.description ?? ''}
          onChange={(v) => update({ description: v || undefined })}
          placeholder="Optional description…"
        />
      </FieldRow>

      <FieldRow label="is_a">
        <Select
          value={classDef.isA ?? ''}
          onChange={(v) => update({ isA: v || undefined })}
          options={allClassNames}
          placeholder="(none)"
        />
      </FieldRow>

      <FieldRow label="Flags">
        <div>
          <Checkbox label="abstract" checked={!!classDef.abstract} onChange={(v) => update({ abstract: v || undefined })} />
          <Checkbox label="mixin" checked={!!classDef.mixin} onChange={(v) => update({ mixin: v || undefined })} />
          <Checkbox label="tree_root" checked={!!classDef.treeRoot} onChange={(v) => update({ treeRoot: v || undefined })} />
        </div>
      </FieldRow>

      <FieldRow label="class_uri">
        <TextInput
          value={classDef.uriAnnotation ?? ''}
          onChange={(v) => update({ uriAnnotation: v || undefined })}
          placeholder="e.g. schema:Person"
          monospace
        />
      </FieldRow>

      <SectionHeader title="Attributes" />

      {Object.values(classDef.attributes).map((slot) => (
        <SlotInlineEditor
          key={slot.name}
          slot={slot}
          rangeOptions={rangeOptions}
          onUpdate={(partial) => updateAttribute(schemaId, className, slot.name, partial)}
          onDelete={() => {
            deleteAttribute(schemaId, className, slot.name);
          }}
        />
      ))}

      <div style={styles.addRow}>
        <input
          style={{ ...styles.input, flex: 1 }}
          placeholder="new attribute name…"
          value={newSlotName}
          onChange={(e) => setNewSlotName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddSlot()}
        />
        <button style={styles.btnPrimary} onClick={handleAddSlot}>
          + Add
        </button>
      </div>

      <SectionHeader title="Actions" />
      <div style={styles.actionsRow}>
        <DeleteButton
          label="class"
          onConfirm={() => {
            deleteClass(schemaId, className);
            setActiveEntity(null);
          }}
        />
      </div>
    </div>
  );
}

function SlotInlineEditor({
  slot,
  rangeOptions,
  onUpdate,
  onDelete,
}: {
  slot: SlotDefinition;
  rangeOptions: string[];
  onUpdate: (partial: Partial<SlotDefinition>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={styles.slotEditor}>
      <div style={styles.slotEditorHeader} onClick={() => setExpanded((v) => !v)}>
        <span style={styles.slotEditorToggle}>{expanded ? '▾' : '▸'}</span>
        <span style={styles.slotEditorName}>{slot.name}</span>
        {slot.range && <span style={styles.slotEditorRange}>: {slot.range}</span>}
        <div style={styles.slotEditorBadges}>
          {slot.required && <span style={styles.slotBadge}>R</span>}
          {slot.multivalued && <span style={styles.slotBadge}>M</span>}
          {slot.identifier && <span style={styles.slotBadge}>id</span>}
        </div>
      </div>

      {expanded && (
        <div style={styles.slotEditorBody}>
          <FieldRow label="Description">
            <TextArea
              value={slot.description ?? ''}
              onChange={(v) => onUpdate({ description: v || undefined })}
              placeholder="Optional…"
            />
          </FieldRow>
          <FieldRow label="Range">
            <Select
              value={slot.range ?? ''}
              onChange={(v) => onUpdate({ range: v || undefined })}
              options={rangeOptions}
              placeholder="(none)"
            />
          </FieldRow>
          <FieldRow label="Tier 1 flags">
            <div>
              <Checkbox label="required" checked={!!slot.required} onChange={(v) => onUpdate({ required: v || undefined })} />
              <Checkbox label="multivalued" checked={!!slot.multivalued} onChange={(v) => onUpdate({ multivalued: v || undefined })} />
              <Checkbox label="identifier" checked={!!slot.identifier} onChange={(v) => onUpdate({ identifier: v || undefined })} />
            </div>
          </FieldRow>
          <FieldRow label="Tier 2 flags">
            <div>
              <Checkbox label="recommended" checked={!!slot.recommended} onChange={(v) => onUpdate({ recommended: v || undefined })} />
              <Checkbox label="inlined" checked={!!slot.inlined} onChange={(v) => onUpdate({ inlined: v || undefined })} />
            </div>
          </FieldRow>
          <FieldRow label="pattern">
            <TextInput
              value={(slot.extras?.['pattern'] as string) ?? ''}
              onChange={(v) => onUpdate({ extras: { ...(slot.extras ?? {}), pattern: v || undefined } })}
              placeholder="regex pattern"
              monospace
            />
          </FieldRow>
          <FieldRow label="slot_uri">
            <TextInput
              value={slot.slotUri ?? ''}
              onChange={(v) => onUpdate({ slotUri: v || undefined })}
              placeholder="e.g. schema:name"
              monospace
            />
          </FieldRow>
          <div style={styles.slotEditorActions}>
            <DeleteButton label="attribute" onConfirm={onDelete} />
          </div>
        </div>
      )}
    </div>
  );
}

function EnumPanel({ schemaId, enumName }: { schemaId: string; enumName: string }) {
  const schema = useAppStore((s) => s.getActiveSchema())?.schema;
  const updateEnum = useAppStore((s) => s.updateEnum);
  const addPermissibleValue = useAppStore((s) => s.addPermissibleValue);
  const updatePermissibleValue = useAppStore((s) => s.updatePermissibleValue);
  const deletePermissibleValue = useAppStore((s) => s.deletePermissibleValue);
  const deleteEnum = useAppStore((s) => s.deleteEnum);
  const setActiveEntity = useAppStore((s) => s.setActiveEntity);

  const enumDef = schema?.enums[enumName] as EnumDefinition | undefined;
  if (!enumDef) return <EmptyPanel message="Enum not found" />;
  const enm = enumDef;

  const update = (partial: Partial<EnumDefinition>) => updateEnum(schemaId, enumName, partial);

  const [newValue, setNewValue] = useState('');

  function handleAddValue() {
    const text = newValue.trim();
    if (!text || enm.permissibleValues[text]) return;
    addPermissibleValue(schemaId, enumName, { text });
    setNewValue('');
  }

  return (
    <div>
      <SectionHeader title="Enum Properties" />

      <FieldRow label="Name">
        <TextInput value={enumDef.name} onChange={() => {}} monospace />
      </FieldRow>

      <FieldRow label="Description">
        <TextArea
          value={enumDef.description ?? ''}
          onChange={(v) => update({ description: v || undefined })}
          placeholder="Optional description…"
        />
      </FieldRow>

      <FieldRow label="code_set">
        <TextInput
          value={enumDef.codeSet ?? ''}
          onChange={(v) => update({ codeSet: v || undefined })}
          placeholder="URI of external value set"
          monospace
        />
      </FieldRow>

      <SectionHeader title="Permissible Values" />

      {Object.values(enumDef.permissibleValues).map((pv) => (
        <PermissibleValueEditor
          key={pv.text}
          value={pv}
          onUpdate={(partial) => updatePermissibleValue(schemaId, enumName, pv.text, partial)}
          onDelete={() => deletePermissibleValue(schemaId, enumName, pv.text)}
        />
      ))}

      <div style={styles.addRow}>
        <input
          style={{ ...styles.input, flex: 1 }}
          placeholder="new value text…"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddValue()}
        />
        <button style={styles.btnPrimary} onClick={handleAddValue}>
          + Add
        </button>
      </div>

      <SectionHeader title="Actions" />
      <div style={styles.actionsRow}>
        <DeleteButton
          label="enum"
          onConfirm={() => {
            deleteEnum(schemaId, enumName);
            setActiveEntity(null);
          }}
        />
      </div>
    </div>
  );
}

function PermissibleValueEditor({
  value,
  onUpdate,
  onDelete,
}: {
  value: PermissibleValue;
  onUpdate: (partial: Partial<PermissibleValue>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={styles.slotEditor}>
      <div style={styles.slotEditorHeader} onClick={() => setExpanded((v) => !v)}>
        <span style={styles.slotEditorToggle}>{expanded ? '▾' : '▸'}</span>
        <span style={styles.slotEditorName}>{value.text}</span>
        {value.meaning && <span style={styles.slotEditorRange}> = {value.meaning}</span>}
      </div>

      {expanded && (
        <div style={styles.slotEditorBody}>
          <FieldRow label="Description">
            <TextArea
              value={value.description ?? ''}
              onChange={(v) => onUpdate({ description: v || undefined })}
              placeholder="Optional…"
            />
          </FieldRow>
          <FieldRow label="meaning">
            <TextInput
              value={value.meaning ?? ''}
              onChange={(v) => onUpdate({ meaning: v || undefined })}
              placeholder="URI / CURIE"
              monospace
            />
          </FieldRow>
          <div style={styles.slotEditorActions}>
            <DeleteButton label="value" onConfirm={onDelete} />
          </div>
        </div>
      )}
    </div>
  );
}

function EdgePanel({ edgeId }: { edgeId: string }) {
  const edges = useAppStore((s) => s.edges);
  const edge = edges.find((e) => e.id === edgeId);

  if (!edge) return <EmptyPanel message="Edge not found" />;

  const source = edge.source;
  const target = edge.target;

  return (
    <div>
      <SectionHeader title="Edge (read-only)" />
      <FieldRow label="Type">
        <span style={styles.readOnlyValue}>{edge.type}</span>
      </FieldRow>
      <FieldRow label="Source">
        <span style={styles.readOnlyValue}>{source}</span>
      </FieldRow>
      <FieldRow label="Target">
        <span style={styles.readOnlyValue}>{target}</span>
      </FieldRow>
      {edge.label && (
        <FieldRow label="Label">
          <span style={styles.readOnlyValue}>{String(edge.label)}</span>
        </FieldRow>
      )}
    </div>
  );
}

function SchemaMetaPanel({ schemaId }: { schemaId: string }) {
  const schema = useAppStore((s) => s.getActiveSchema())?.schema;
  const updateSchema = useAppStore((s) => s.updateSchema);

  if (!schema) return <EmptyPanel message="No schema loaded" />;

  const update = (partial: Parameters<typeof updateSchema>[1]) => updateSchema(schemaId, partial);

  return (
    <div>
      <SectionHeader title="Schema Identity" />

      <FieldRow label="id (URI)">
        <TextInput
          value={schema.id}
          onChange={(v) => update({ id: v })}
          placeholder="https://example.org/my-schema"
          monospace
        />
      </FieldRow>

      <FieldRow label="name">
        <TextInput
          value={schema.name}
          onChange={(v) => update({ name: v })}
          placeholder="schema-name"
          monospace
        />
      </FieldRow>

      <FieldRow label="title">
        <TextInput
          value={schema.title ?? ''}
          onChange={(v) => update({ title: v || undefined })}
          placeholder="Human-readable title"
        />
      </FieldRow>

      <FieldRow label="description">
        <TextArea
          value={schema.description ?? ''}
          onChange={(v) => update({ description: v || undefined })}
          placeholder="Optional description…"
        />
      </FieldRow>

      <FieldRow label="version">
        <TextInput
          value={schema.version ?? ''}
          onChange={(v) => update({ version: v || undefined })}
          placeholder="e.g. 1.0.0"
          monospace
        />
      </FieldRow>

      <FieldRow label="license">
        <TextInput
          value={schema.license ?? ''}
          onChange={(v) => update({ license: v || undefined })}
          placeholder="e.g. CC-BY-4.0"
          monospace
        />
      </FieldRow>

      <FieldRow label="default_prefix">
        <TextInput
          value={schema.defaultPrefix}
          onChange={(v) => update({ defaultPrefix: v })}
          monospace
        />
      </FieldRow>

      <FieldRow label="default_range">
        <TextInput
          value={schema.defaultRange ?? ''}
          onChange={(v) => update({ defaultRange: v || undefined })}
          placeholder="e.g. string"
          monospace
        />
      </FieldRow>
    </div>
  );
}

function EmptyPanel({ message }: { message?: string }) {
  return (
    <div style={styles.emptyPanel}>
      <p style={styles.emptyMessage}>{message ?? 'Select an element on the canvas'}</p>
      <p style={styles.emptyHint}>
        Click a class or enum node, or select an edge to edit its properties.
      </p>
    </div>
  );
}

// ── Top-level PropertiesPanel ─────────────────────────────────────────────────

export function PropertiesPanel() {
  const activeEntity = useAppStore((s) => s.activeEntity);
  const propertiesPanelOpen = useAppStore((s) => s.propertiesPanelOpen);
  const setPropertiesPanelOpen = useAppStore((s) => s.setPropertiesPanelOpen);
  const propertiesPanelWidth = useAppStore((s) => s.propertiesPanelWidth);
  const activeSchemaFile = useAppStore((s) => s.getActiveSchema());

  const schemaId = activeSchemaFile?.id ?? '';

  // Temporal undo/redo
  const undo = useCallback(() => {
    (useAppStore as unknown as { temporal: { getState: () => { undo: () => void } } }).temporal.getState().undo();
  }, []);
  const redo = useCallback(() => {
    (useAppStore as unknown as { temporal: { getState: () => { redo: () => void } } }).temporal.getState().redo();
  }, []);

  if (!propertiesPanelOpen) {
    return (
      <button style={styles.collapsedTab} onClick={() => setPropertiesPanelOpen(true)} title="Open Properties Panel">
        ‹ P
      </button>
    );
  }

  function renderContent() {
    if (!activeEntity) {
      if (activeSchemaFile) {
        return <SchemaMetaPanel schemaId={schemaId} />;
      }
      return <EmptyPanel />;
    }
    switch (activeEntity.type) {
      case 'class':
        return <ClassPanel schemaId={schemaId} className={activeEntity.className} />;
      case 'slot':
        return (
          <ClassPanel schemaId={schemaId} className={activeEntity.className} />
        );
      case 'enum':
        return <EnumPanel schemaId={schemaId} enumName={activeEntity.enumName} />;
      case 'edge':
        return <EdgePanel edgeId={activeEntity.edgeId} />;
      default:
        return <EmptyPanel />;
    }
  }

  return (
    <div style={{ ...styles.panel, width: propertiesPanelWidth }}>
      {/* Panel header */}
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>Properties</span>
        <div style={styles.panelHeaderActions}>
          <button style={styles.headerBtn} onClick={undo} title="Undo (Ctrl+Z)">
            ↩
          </button>
          <button style={styles.headerBtn} onClick={redo} title="Redo (Ctrl+Shift+Z)">
            ↪
          </button>
          <button style={styles.headerBtn} onClick={() => setPropertiesPanelOpen(false)} title="Close panel">
            ✕
          </button>
        </div>
      </div>

      {/* Entity breadcrumb */}
      {activeEntity && (
        <div style={styles.breadcrumb}>
          {activeEntity.type === 'class' && `class: ${activeEntity.className}`}
          {activeEntity.type === 'slot' && `${activeEntity.className} › ${activeEntity.slotName}`}
          {activeEntity.type === 'enum' && `enum: ${activeEntity.enumName}`}
          {activeEntity.type === 'edge' && `edge: ${activeEntity.edgeId.split('__')[0]}`}
        </div>
      )}

      {/* Content */}
      <div style={styles.panelBody}>{renderContent()}</div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: '#0f172a',
    borderLeft: '1px solid #1e293b',
    height: '100%',
    flexShrink: 0,
    overflow: 'hidden',
  },
  collapsedTab: {
    writingMode: 'vertical-rl',
    background: '#0f172a',
    border: 'none',
    borderLeft: '1px solid #1e293b',
    color: '#475569',
    cursor: 'pointer',
    padding: '8px 4px',
    fontSize: 11,
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid #1e293b',
    background: '#0f172a',
    flexShrink: 0,
  },
  panelTitle: {
    fontWeight: 600,
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  panelHeaderActions: {
    display: 'flex',
    gap: 4,
  },
  headerBtn: {
    background: 'transparent',
    border: '1px solid #334155',
    color: '#64748b',
    cursor: 'pointer',
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 1.4,
  },
  breadcrumb: {
    padding: '4px 12px',
    fontSize: 11,
    color: '#60a5fa',
    fontFamily: 'monospace',
    background: '#0d1b2e',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  panelBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 0 16px',
  },
  sectionHeader: {
    padding: '8px 12px 4px',
    fontSize: 10,
    fontWeight: 700,
    color: '#475569',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    borderBottom: '1px solid #1e293b',
    marginTop: 4,
  },
  fieldRow: {
    padding: '5px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  fieldLabel: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 4,
    color: '#e2e8f0',
    fontSize: 12,
    padding: '4px 7px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'sans-serif',
  },
  inputMono: {
    fontFamily: 'monospace',
  },
  textarea: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 4,
    color: '#e2e8f0',
    fontSize: 12,
    padding: '4px 7px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: 'sans-serif',
  },
  select: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 4,
    color: '#e2e8f0',
    fontSize: 12,
    padding: '4px 7px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'monospace',
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: '#94a3b8',
    cursor: 'pointer',
    fontFamily: 'monospace',
    padding: '2px 0',
  },
  checkbox: {
    accentColor: '#3b82f6',
  },
  slotEditor: {
    borderBottom: '1px solid #1e293b',
    margin: '0 0',
  },
  slotEditorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 12px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  slotEditorToggle: {
    color: '#475569',
    fontSize: 10,
    width: 10,
    flexShrink: 0,
  },
  slotEditorName: {
    color: '#e2e8f0',
    fontFamily: 'monospace',
    fontSize: 12,
    flex: '0 1 auto',
  },
  slotEditorRange: {
    color: '#86efac',
    fontFamily: 'monospace',
    fontSize: 11,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  slotEditorBadges: {
    display: 'flex',
    gap: 2,
    flexShrink: 0,
  },
  slotBadge: {
    fontSize: 9,
    background: '#334155',
    borderRadius: 3,
    padding: '0 3px',
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  slotEditorBody: {
    background: '#091120',
    paddingBottom: 6,
  },
  slotEditorActions: {
    padding: '4px 12px',
    display: 'flex',
    gap: 6,
  },
  addRow: {
    display: 'flex',
    gap: 6,
    padding: '6px 12px',
    alignItems: 'center',
  },
  actionsRow: {
    padding: '8px 12px',
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  btnPrimary: {
    background: '#1d4ed8',
    border: '1px solid #2563eb',
    color: '#fff',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  btnDanger: {
    background: '#7f1d1d',
    border: '1px solid #991b1b',
    color: '#fca5a5',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  deleteConfirm: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  deleteConfirmText: {
    fontSize: 12,
    color: '#fca5a5',
    fontFamily: 'monospace',
  },
  readOnlyValue: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#94a3b8',
    padding: '4px 0',
    display: 'block',
  },
  emptyPanel: {
    padding: '24px 16px',
    textAlign: 'center',
    color: '#475569',
  },
  emptyMessage: {
    fontSize: 13,
    fontWeight: 600,
    color: '#64748b',
    margin: '0 0 8px',
    fontFamily: 'monospace',
  },
  emptyHint: {
    fontSize: 11,
    margin: 0,
    lineHeight: 1.5,
  },
};
