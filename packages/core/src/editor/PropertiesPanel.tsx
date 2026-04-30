/**
 * PropertiesPanel — context-sensitive side panel.
 * Shows fields based on the currently selected entity (class/slot/enum/edge/schema).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useAppStore } from '../store/index.js';
import type { ClassDefinition, SlotDefinition, EnumDefinition, PermissibleValue, SchemaFile, LinkMLSchema, ClassRule, SlotCondition, AnonymousClassExpression } from '../model/index.js';
import { emptyCanvasLayout } from '../model/index.js';
import { usePlatform } from '../platform/PlatformContext.js';
import { parseYaml } from '../io/yaml.js';
import { AlertTriangle, X } from '../ui/icons/index.js';
import { isUrlImport, isLocalImport, resolveImportPath } from '../io/importResolver.js';
import { FieldRow, TextInput, TextArea, Checkbox, FilteredGroupedSelect } from '../ui/fields/index.js';
import type { OptionGroup } from '../ui/fields/index.js';
import { inputStyle, inputMonoStyle, selectStyle } from '../ui/fields/TextInput.js';
import { EmptyPanel } from './PropertiesPanel/EmptyPanel.js';
import { SectionHeader, DeleteButton } from './PropertiesPanel/internal.js';
import { PermissibleValueEditor } from './PropertiesPanel/PermissibleValueEditor.js';
import { SlotConditionEditor } from './PropertiesPanel/SlotConditionEditor.js';
import { ClassExpressionEditor } from './PropertiesPanel/ClassExpressionEditor.js';
import { RuleEditor } from './PropertiesPanel/RuleEditor.js';
import { SlotInlineEditor } from './PropertiesPanel/SlotInlineEditor.js';
import { SchemaSlotInlineEditor } from './PropertiesPanel/SchemaSlotInlineEditor.js';
import { EnumPanel } from './PropertiesPanel/EnumPanel.js';
import { ClassPanel } from './PropertiesPanel/ClassPanel.js';
import { styles } from './PropertiesPanel/styles.js';
import { useRangeOptionGroups } from './PropertiesPanel/hooks/useRangeOptionGroups.js';


/** Parse a range edge ID: `range__{className}__{slotName}__{target}` */
export function parseRangeEdgeId(edgeId: string): { className: string; slotName: string; target: string } | null {
  if (!edgeId.startsWith('range__')) return null;
  const parts = edgeId.split('__');
  if (parts.length < 4) return null;
  return { className: parts[1], slotName: parts[2], target: parts.slice(3).join('__') };
}

const EDGE_TYPE_DESCRIPTIONS: Record<string, string> = {
  is_a: 'Inheritance — this class extends the target class.',
  mixin: 'Mixin — this class incorporates attributes from the target.',
  union_of: 'Union — the target is one of the constituent types.',
};

function EdgePanel({ edgeId }: { edgeId: string }) {
  const edges = useAppStore((s) => s.edges);
  const edge = edges.find((e) => e.id === edgeId);
  const schema = useAppStore((s) => s.getActiveSchema());
  const updateAttribute = useAppStore((s) => s.updateAttribute);
  const autoAddImportForRange = useAppStore((s) => s.autoAddImportForRange);

  const rangeInfo = parseRangeEdgeId(edgeId);
  const schemaId = schema?.id ?? '';
  const schemaData = schema?.schema;

  const rangeOptionGroups = useRangeOptionGroups(schemaId);

  if (!edge) return <EmptyPanel message="Edge not found" />;

  // For range edges, resolve the slot and render an inline editor
  if (rangeInfo && schemaData) {
    const classDef = schemaData.classes[rangeInfo.className];
    const slot = classDef?.attributes[rangeInfo.slotName];

    if (slot) {
      return (
        <div>
          <SectionHeader title="Range Edge (editable)" />
          <div style={styles.editableBadge}>editable</div>
          <FieldRow label="Source">
            <span style={styles.readOnlyValue}>{rangeInfo.className}</span>
          </FieldRow>
          <FieldRow label="Target">
            <span style={styles.readOnlyValue}>{rangeInfo.target}</span>
          </FieldRow>
          <SectionHeader title="Slot Properties" />
          <SlotInlineEditor
            slot={slot}
            rangeOptionGroups={rangeOptionGroups}
            onUpdate={(partial) => {
              if (partial.range) {
                autoAddImportForRange(schemaId, partial.range);
              }
              updateAttribute(schemaId, rangeInfo.className, rangeInfo.slotName, partial);
            }}
            onDelete={() => {}}
          />
        </div>
      );
    }
  }

  // Non-range edges: read-only display with relationship description
  const edgeType = edge.type ?? edgeId.split('__')[0] ?? 'unknown';
  const description = EDGE_TYPE_DESCRIPTIONS[edgeType];

  return (
    <div>
      <SectionHeader title="Edge (read-only)" />
      <FieldRow label="Type">
        <span style={styles.readOnlyValue}>{edgeType}</span>
      </FieldRow>
      <FieldRow label="Source">
        <span style={styles.readOnlyValue}>{edge.source}</span>
      </FieldRow>
      <FieldRow label="Target">
        <span style={styles.readOnlyValue}>{edge.target}</span>
      </FieldRow>
      {edge.label && (
        <FieldRow label="Label">
          <span style={styles.readOnlyValue}>{String(edge.label)}</span>
        </FieldRow>
      )}
      {description && (
        <FieldRow label="Description">
          <span style={styles.edgeDescription}>{description}</span>
        </FieldRow>
      )}
    </div>
  );
}

function SchemaMetaPanel({ schemaId }: { schemaId: string }) {
  const activeSchemaFile = useAppStore((s) => s.getActiveSchema());
  const schema = activeSchemaFile?.schema;
  const updateSchema = useAppStore((s) => s.updateSchema);
  const addImport = useAppStore((s) => s.addImport);
  const addSchemaFile = useAppStore((s) => s.addSchemaFile);
  const removeSchemaFile = useAppStore((s) => s.removeSchemaFile);
  const activeProject = useAppStore((s) => s.activeProject);
  const platform = usePlatform();
  const addSchemaSlot = useAppStore((s) => s.addSchemaSlot);
  const updateSchemaSlot = useAppStore((s) => s.updateSchemaSlot);
  const deleteSchemaSlot = useAppStore((s) => s.deleteSchemaSlot);
  const renameSchemaSlot = useAppStore((s) => s.renameSchemaSlot);

  const [newImport, setNewImport] = React.useState('');
  const [resolving, setResolving] = React.useState(false);
  const [newSchemaSlotName, setNewSchemaSlotName] = React.useState('');
  const [newPrefixKey, setNewPrefixKey] = React.useState('');
  const [newPrefixUri, setNewPrefixUri] = React.useState('');
  const rangeOptionGroups = useRangeOptionGroups(schemaId);

  if (!schema) return <EmptyPanel message="No schema loaded" />;

  const update = (partial: Parameters<typeof updateSchema>[1]) => updateSchema(schemaId, partial);

  const handleAddImport = async () => {
    const imp = newImport.trim();
    if (!imp || schema.imports.includes(imp)) return;

    addImport(schemaId, imp);
    setNewImport('');

    // Attempt to resolve and load the imported schema
    setResolving(true);
    try {
      let file: SchemaFile | null = null;

      if (isUrlImport(imp)) {
        try {
          const resp = await fetch(imp);
          if (resp.ok) {
            const content = await resp.text();
            const parsedSchema = parseYaml(content);
            file = {
              id: crypto.randomUUID(),
              filePath: imp,
              schema: parsedSchema,
              isDirty: false,
              canvasLayout: emptyCanvasLayout(),
              isReadOnly: true,
              sourceUrl: imp,
            };
          }
        } catch { /* URL not reachable — validation panel will flag it */ }
      } else if (isLocalImport(imp) && activeSchemaFile && activeProject) {
        const resolved = resolveImportPath(imp, activeSchemaFile.filePath, activeProject.rootPath);
        if (!activeProject.schemas.some((s) => s.filePath === resolved)) {
          try {
            const absPath = activeProject.rootPath ? `${activeProject.rootPath}/${resolved}` : resolved;
            const content = await platform.readFile(absPath);
            const parsedSchema = parseYaml(content);
            file = {
              id: crypto.randomUUID(),
              filePath: resolved,
              schema: parsedSchema,
              isDirty: false,
              canvasLayout: emptyCanvasLayout(),
              isReadOnly: true,
            };
          } catch { /* File not found — validation panel will flag it */ }
        }
      }

      if (file) addSchemaFile(file);
    } finally {
      setResolving(false);
    }
  };

  const handleRemoveImport = (imp: string) => {
    update({ imports: schema.imports.filter((i) => i !== imp) });

    if (!activeProject || !activeSchemaFile) return;

    // Determine the resolved key for this import
    let resolvedKey: string;
    if (isUrlImport(imp)) {
      resolvedKey = imp;
    } else if (isLocalImport(imp)) {
      resolvedKey = resolveImportPath(imp, activeSchemaFile.filePath, activeProject.rootPath);
    } else {
      return;
    }

    // Remove the associated read-only SchemaFile if no other schema still imports it
    const importedFile = activeProject.schemas.find((s) => s.filePath === resolvedKey && s.isReadOnly);
    if (importedFile) {
      const stillNeeded = activeProject.schemas.some((s) => {
        if (s.id === schemaId) return false;
        return s.schema.imports.some((i) => {
          if (isUrlImport(i)) return i === resolvedKey;
          if (isLocalImport(i)) return resolveImportPath(i, s.filePath, activeProject.rootPath) === resolvedKey;
          return false;
        });
      });
      if (!stillNeeded) removeSchemaFile(importedFile.id);
    }
  };

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

      <SectionHeader title="Prefixes" />

      {Object.entries(schema.prefixes ?? {}).map(([key, uri]) => (
        <div key={key} style={styles.importRow}>
          <span style={{ ...styles.importPath, flexShrink: 0, width: 80 }}>{key}</span>
          <input
            style={{ ...inputStyle, ...inputMonoStyle, flex: 1, fontSize: 11 }}
            value={uri}
            onChange={(e) => update({ prefixes: { ...schema.prefixes, [key]: e.target.value } })}
          />
          <button
            style={styles.importRemoveBtn}
            title="Remove prefix"
            onClick={() => {
              const next = { ...schema.prefixes };
              delete next[key];
              update({ prefixes: next });
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}

      <div style={styles.addRow}>
        <input
          style={{ ...inputStyle, ...inputMonoStyle, width: 80, flexShrink: 0 }}
          placeholder="prefix"
          value={newPrefixKey}
          onChange={(e) => setNewPrefixKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const k = newPrefixKey.trim();
              if (k) {
                update({ prefixes: { ...schema.prefixes, [k]: newPrefixUri.trim() } });
                setNewPrefixKey('');
                setNewPrefixUri('');
              }
            }
          }}
        />
        <input
          style={{ ...inputStyle, ...inputMonoStyle, flex: 1 }}
          placeholder="https://…"
          value={newPrefixUri}
          onChange={(e) => setNewPrefixUri(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const k = newPrefixKey.trim();
              if (k) {
                update({ prefixes: { ...schema.prefixes, [k]: newPrefixUri.trim() } });
                setNewPrefixKey('');
                setNewPrefixUri('');
              }
            }
          }}
        />
        <button
          style={{
            ...styles.btnPrimary,
            ...(!newPrefixKey.trim() ? { opacity: 0.4, cursor: 'default' } : {}),
          }}
          disabled={!newPrefixKey.trim()}
          onClick={() => {
            const k = newPrefixKey.trim();
            if (k) {
              update({ prefixes: { ...schema.prefixes, [k]: newPrefixUri.trim() } });
              setNewPrefixKey('');
              setNewPrefixUri('');
            }
          }}
        >
          +
        </button>
      </div>

      <SectionHeader title="Schema Slots" />

      {Object.values(schema.slots ?? {}).map((slot) => (
        <SchemaSlotInlineEditor
          key={slot.name}
          slot={slot}
          schemaSlots={schema.slots ?? {}}
          rangeOptionGroups={rangeOptionGroups}
          onUpdate={(partial) => updateSchemaSlot(schemaId, slot.name, partial)}
          onDelete={() => deleteSchemaSlot(schemaId, slot.name)}
          onRename={(newName) => renameSchemaSlot(schemaId, slot.name, newName)}
        />
      ))}

      <div style={styles.addRow}>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="new slot name…"
          value={newSchemaSlotName}
          onChange={(e) => setNewSchemaSlotName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const name = newSchemaSlotName.trim();
              if (name && !(schema.slots ?? {})[name]) {
                addSchemaSlot(schemaId, { name });
                setNewSchemaSlotName('');
              }
            }
          }}
        />
        <button
          style={styles.btnPrimary}
          onClick={() => {
            const name = newSchemaSlotName.trim();
            if (name && !(schema.slots ?? {})[name]) {
              addSchemaSlot(schemaId, { name });
              setNewSchemaSlotName('');
            }
          }}
        >
          + Add
        </button>
      </div>

      <SectionHeader title="Imports" />

      {schema.imports.map((imp) => (
        <div key={imp} style={styles.importRow}>
          <span style={styles.importPath}>{imp}</span>
          <button
            style={styles.importRemoveBtn}
            onClick={() => handleRemoveImport(imp)}
            title="Remove import"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      <div style={styles.addRow}>
        <input
          style={{ ...inputStyle, ...inputMonoStyle, flex: 1 }}
          value={newImport}
          onChange={(e) => setNewImport(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddImport(); }}
          placeholder="linkml:types, ./common, https://…"
          disabled={resolving}
        />
        <button
          style={{
            ...styles.btnPrimary,
            ...(!newImport.trim() || resolving ? { opacity: 0.4, cursor: 'default' } : {}),
          }}
          onClick={handleAddImport}
          disabled={!newImport.trim() || resolving}
        >
          {resolving ? '…' : '+'}
        </button>
      </div>
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
    <div id="lme-properties-panel" style={{ ...styles.panel, width: propertiesPanelWidth }}>
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
            <X size={12} />
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

      {/* Read-only notice */}
      {activeSchemaFile?.isReadOnly && (
        <div style={styles.readOnlyNotice}>
          Read Only — imported schema
        </div>
      )}

      {/* Content */}
      <div style={styles.panelBody}>{renderContent()}</div>
    </div>
  );
}

