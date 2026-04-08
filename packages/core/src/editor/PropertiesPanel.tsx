/**
 * PropertiesPanel — context-sensitive side panel.
 * Shows fields based on the currently selected entity (class/slot/enum/edge/schema).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useAppStore } from '../store/index.js';
import type { ClassDefinition, SlotDefinition, EnumDefinition, PermissibleValue, SchemaFile, LinkMLSchema } from '../model/index.js';
import { emptyCanvasLayout } from '../model/index.js';
import { usePlatform } from '../platform/PlatformContext.js';
import { parseYaml } from '../io/yaml.js';
import { isUrlImport, isLocalImport, resolveImportPath } from '../io/importResolver.js';

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
  onCommit,
  placeholder,
  monospace,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: (v: string) => void;
  placeholder?: string;
  monospace?: boolean;
}) {
  const [localValue, setLocalValue] = React.useState<string | null>(null);
  const committed = localValue === null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onCommit) {
      setLocalValue(e.target.value);
    } else {
      onChange(e.target.value);
    }
  };

  const handleBlur = () => {
    if (onCommit && localValue !== null) {
      onCommit(localValue);
      setLocalValue(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onCommit && e.key === 'Enter' && localValue !== null) {
      onCommit(localValue);
      setLocalValue(null);
      (e.target as HTMLInputElement).blur();
    } else if (onCommit && e.key === 'Escape') {
      setLocalValue(null);
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      style={{ ...styles.input, ...(monospace ? styles.inputMono : {}) }}
      value={committed ? (value ?? '') : localValue!}
      placeholder={placeholder}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
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


interface OptionGroup {
  label: string;
  options: string[];
}

function FilteredGroupedSelect({
  value,
  onChange,
  groups,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  groups: OptionGroup[];
  placeholder?: string;
}) {
  const [filterText, setFilterText] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Build flat filtered options
  const flatOptions = React.useMemo(() => {
    const lower = filterText.toLowerCase();
    const result: Array<{ group: string; option: string }> = [];
    for (const g of groups) {
      for (const o of g.options) {
        if (!filterText || o.toLowerCase().includes(lower)) {
          result.push({ group: g.label, option: o });
        }
      }
    }
    return result;
  }, [groups, filterText]);

  // Build filtered groups for display
  const filteredGroups = React.useMemo(() => {
    const lower = filterText.toLowerCase();
    return groups.map((g) => ({
      ...g,
      options: filterText ? g.options.filter((o) => o.toLowerCase().includes(lower)) : g.options,
    })).filter((g) => g.options.length > 0);
  }, [groups, filterText]);

  const open = () => {
    setFilterText('');
    setFocusedIndex(-1);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const selectOption = (opt: string) => {
    onChange(opt);
    close();
  };

  // Click outside detection
  React.useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        open();
        return;
      }
      return;
    }
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, flatOptions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === 'Enter') {
      if (focusedIndex >= 0 && focusedIndex < flatOptions.length) {
        selectOption(flatOptions[focusedIndex].option);
      } else {
        // Allow free text entry
        onChange(filterText);
        close();
      }
      return;
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Only close if focus leaves the wrapper entirely
    if (wrapperRef.current && wrapperRef.current.contains(e.relatedTarget as Node)) return;
    if (!isOpen) return;
    // commit free-typed value on blur
    if (filterText && filterText !== value) {
      onChange(filterText);
    }
    close();
  };

  // Compute flat index for a given group/option combo
  const getFlatIndex = (groupLabel: string, opt: string) => {
    return flatOptions.findIndex((f) => f.group === groupLabel && f.option === opt);
  };

  const inputStyle: React.CSSProperties = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 4,
    color: '#e2e8f0',
    fontSize: 12,
    padding: '4px 7px',
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    fontFamily: 'monospace',
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }} tabIndex={-1}>
      <input
        style={inputStyle}
        value={isOpen ? filterText : (value || '')}
        placeholder={placeholder ?? ''}
        onChange={(e) => setFilterText(e.target.value)}
        onFocus={open}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 200,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 4,
            maxHeight: 220,
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
          onMouseDown={(e) => e.preventDefault()} // prevent blur on option click
        >
          {filteredGroups.length === 0 ? (
            <div style={{ padding: '6px 10px', fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
              No options
            </div>
          ) : (
            filteredGroups.map((g) => (
              <div key={g.label}>
                <div
                  style={{
                    padding: '4px 8px 2px',
                    fontSize: 9,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontFamily: 'monospace',
                  }}
                >
                  {g.label}
                  {filterText && ` (${g.options.length})`}
                </div>
                {g.options.map((o) => {
                  const flatIdx = getFlatIndex(g.label, o);
                  const isFocused = flatIdx === focusedIndex;
                  return (
                    <div
                      key={o}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        cursor: 'pointer',
                        color: '#e2e8f0',
                        background: isFocused ? '#334155' : 'transparent',
                        fontFamily: 'monospace',
                      }}
                      onMouseEnter={() => setFocusedIndex(flatIdx)}
                      onMouseLeave={() => setFocusedIndex(-1)}
                      onClick={() => selectOption(o)}
                    >
                      {o}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
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

/** Returns grouped class+enum options from every schema in the project. */
function useRangeOptionGroups(_schemaId: string, excludeClassName?: string) {
  const allSchemas = useAppStore((s) => s.activeProject?.schemas ?? []);

  return useMemo(() => {
    const builtinTypes = ['string', 'integer', 'float', 'boolean', 'date', 'datetime', 'uri', 'uriorcurie'];
    const groups: OptionGroup[] = [
      { label: 'Built-in types', options: builtinTypes },
    ];

    for (const sf of allSchemas) {
      const label = sf.filePath.replace(/\.ya?ml$/, '');
      const classNames = Object.keys(sf.schema.classes).filter((n) => n !== excludeClassName).sort();
      const enumNames = Object.keys(sf.schema.enums).sort();
      const options = [...classNames, ...enumNames];
      if (options.length > 0) {
        groups.push({ label, options });
      }
    }

    return groups;
  }, [allSchemas, excludeClassName]);
}

/** Returns grouped class-only options from every schema in the project. */
function useIsAOptionGroups(excludeClassName?: string) {
  const allSchemas = useAppStore((s) => s.activeProject?.schemas ?? []);

  return useMemo(() => {
    const groups: OptionGroup[] = [];

    for (const sf of allSchemas) {
      const label = sf.filePath.replace(/\.ya?ml$/, '');
      const classNames = Object.keys(sf.schema.classes).filter((n) => n !== excludeClassName).sort();
      if (classNames.length > 0) {
        groups.push({ label, options: classNames });
      }
    }

    return groups;
  }, [allSchemas, excludeClassName]);
}

/** Returns grouped schema-level slot names from every schema in the project. */
function useSchemaSlotOptionGroups() {
  const allSchemas = useAppStore((s) => s.activeProject?.schemas ?? []);

  return useMemo(() => {
    const groups: OptionGroup[] = [];
    for (const sf of allSchemas) {
      const slotNames = Object.keys(sf.schema.slots ?? {}).sort();
      if (slotNames.length > 0) {
        groups.push({ label: sf.filePath.replace(/\.ya?ml$/, ''), options: slotNames });
      }
    }
    return groups;
  }, [allSchemas]);
}

/**
 * Walks the is_a + mixin inheritance chain for a class and collects all
 * schema-level slot names (cls.slots[]) accessible via inheritance.
 */
function collectInheritedSlotNames(
  className: string,
  schema: LinkMLSchema,
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(className)) return [];
  visited.add(className);
  const cls = schema.classes[className];
  if (!cls) return [];

  const names: string[] = [...cls.slots];
  if (cls.isA) names.push(...collectInheritedSlotNames(cls.isA, schema, visited));
  for (const mixin of cls.mixins) names.push(...collectInheritedSlotNames(mixin, schema, visited));
  return [...new Set(names)];
}

function ClassPanel({ schemaId, className }: { schemaId: string; className: string }) {
  const schema = useAppStore((s) => s.getActiveSchema())?.schema;
  const updateClass = useAppStore((s) => s.updateClass);
  const renameClass = useAppStore((s) => s.renameClass);
  const addAttribute = useAppStore((s) => s.addAttribute);
  const updateAttribute = useAppStore((s) => s.updateAttribute);
  const deleteAttribute = useAppStore((s) => s.deleteAttribute);
  const renameAttribute = useAppStore((s) => s.renameAttribute);
  const deleteClass = useAppStore((s) => s.deleteClass);
  const setActiveEntity = useAppStore((s) => s.setActiveEntity);
  const autoAddImportForRange = useAppStore((s) => s.autoAddImportForRange);
  const addSlotReferenceToClass = useAppStore((s) => s.addSlotReferenceToClass);
  const removeSlotReferenceFromClass = useAppStore((s) => s.removeSlotReferenceFromClass);
  const updateSlotUsage = useAppStore((s) => s.updateSlotUsage);
  const deleteSlotUsage = useAppStore((s) => s.deleteSlotUsage);
  const allSchemas = useAppStore((s) => s.activeProject?.schemas ?? []);

  const rangeOptionGroups = useRangeOptionGroups(schemaId, className);
  const isAOptionGroups = useIsAOptionGroups(className);
  const schemaSlotOptionGroups = useSchemaSlotOptionGroups();
  const [newSlotName, setNewSlotName] = useState('');
  const [newSlotRefName, setNewSlotRefName] = useState('');
  const [newUsageSlotName, setNewUsageSlotName] = useState('');

  const classDef = schema?.classes[className] as ClassDefinition | undefined;
  if (!classDef) return <EmptyPanel message="Class not found" />;
  const cls = classDef;

  const update = (partial: Partial<ClassDefinition>) => updateClass(schemaId, className, partial);

  // Merge all schema-level slots across all loaded schemas
  const allSchemaSlots = useMemo(() => {
    const merged: Record<string, SlotDefinition> = {};
    for (const sf of allSchemas) Object.assign(merged, sf.schema.slots ?? {});
    return merged;
  }, [allSchemas]);

  // All slot names accessible via inheritance (for slot_usage candidates)
  const inheritedSlotNames = useMemo(
    () => schema ? collectInheritedSlotNames(className, schema, new Set()) : [],
    [schema, className]
  );
  // Slot names that are eligible to add as slot_usage (inherited but not yet overridden)
  const availableForUsage = useMemo(
    () => inheritedSlotNames.filter((n) => !(n in cls.slotUsage)),
    [inheritedSlotNames, cls.slotUsage]
  );

  function handleAddSlot() {
    const name = newSlotName.trim();
    if (!name || cls.attributes[name]) return;
    addAttribute(schemaId, className, { name });
    setNewSlotName('');
  }

  function handleAddSlotRef() {
    const name = newSlotRefName.trim();
    if (!name || cls.slots.includes(name)) return;
    addSlotReferenceToClass(schemaId, className, name);
    setNewSlotRefName('');
  }

  function handleAddSlotUsage() {
    const name = newUsageSlotName.trim();
    if (!name || name in cls.slotUsage) return;
    updateSlotUsage(schemaId, className, name, { name });
    setNewUsageSlotName('');
  }

  return (
    <div>
      <SectionHeader title="Class Properties" />

      <FieldRow label="Name">
        <TextInput
          value={classDef.name}
          onChange={() => {}}
          onCommit={(v) => {
            const newName = v.trim();
            if (newName && newName !== className && !schema?.classes[newName]) {
              renameClass(schemaId, className, newName);
              setActiveEntity({ type: 'class', className: newName });
            }
          }}
          placeholder="class name"
          monospace
        />
      </FieldRow>

      <FieldRow label="Description">
        <TextArea
          value={classDef.description ?? ''}
          onChange={(v) => update({ description: v || undefined })}
          placeholder="Optional description…"
        />
      </FieldRow>

      <FieldRow label="is_a">
        <FilteredGroupedSelect
          value={classDef.isA ?? ''}
          onChange={(v) => {
            if (v) autoAddImportForRange(schemaId, v);
            update({ isA: v || undefined });
          }}
          groups={isAOptionGroups}
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
          rangeOptionGroups={rangeOptionGroups}
          onUpdate={(partial) => {
            if (partial.range) {
              autoAddImportForRange(schemaId, partial.range);
            }
            updateAttribute(schemaId, className, slot.name, partial);
          }}
          onDelete={() => {
            deleteAttribute(schemaId, className, slot.name);
          }}
          onRename={(newName) => renameAttribute(schemaId, className, slot.name, newName)}
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

      <SectionHeader title="Referenced Slots" />

      {cls.slots.map((slotName) => {
        const schemaSlot = allSchemaSlots[slotName];
        return (
          <div key={slotName} style={styles.slotRefRow}>
            <span style={styles.slotRefName}>{slotName}</span>
            {schemaSlot?.range && (
              <span style={styles.slotRefRange}>: {schemaSlot.range}</span>
            )}
            {!schemaSlot && (
              <span style={styles.slotRefMissing}>⚠ not found</span>
            )}
            <button
              style={styles.slotRefRemoveBtn}
              onClick={() => removeSlotReferenceFromClass(schemaId, className, slotName)}
              title="Remove slot reference"
            >
              ✕
            </button>
          </div>
        );
      })}

      <div style={styles.addRow}>
        <div style={{ flex: 1 }}>
          <FilteredGroupedSelect
            value={newSlotRefName}
            onChange={(v) => setNewSlotRefName(v)}
            groups={schemaSlotOptionGroups}
            placeholder="add schema slot reference…"
          />
        </div>
        <button style={styles.btnPrimary} onClick={handleAddSlotRef} disabled={!newSlotRefName.trim()}>
          + Add
        </button>
      </div>

      <SectionHeader title="Slot Usage" />

      {Object.entries(cls.slotUsage).map(([slotName, usage]) => (
        <SlotInlineEditor
          key={slotName}
          slot={{ ...usage, name: slotName } as SlotDefinition}
          rangeOptionGroups={rangeOptionGroups}
          onUpdate={(partial) => {
            if (partial.range) autoAddImportForRange(schemaId, partial.range);
            updateSlotUsage(schemaId, className, slotName, partial);
          }}
          onDelete={() => deleteSlotUsage(schemaId, className, slotName)}
          deleteLabel="override"
          mode="override"
        />
      ))}

      {availableForUsage.length > 0 && (
        <div style={styles.addRow}>
          <div style={{ flex: 1 }}>
            <FilteredGroupedSelect
              value={newUsageSlotName}
              onChange={(v) => setNewUsageSlotName(v)}
              groups={[{ label: 'Inherited slots', options: availableForUsage }]}
              placeholder="add slot_usage override…"
            />
          </div>
          <button style={styles.btnPrimary} onClick={handleAddSlotUsage} disabled={!newUsageSlotName.trim()}>
            + Add
          </button>
        </div>
      )}

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
  rangeOptionGroups,
  onUpdate,
  onDelete,
  onRename,
  deleteLabel = 'slot',
  mode = 'full',
}: {
  slot: SlotDefinition;
  rangeOptionGroups: OptionGroup[];
  onUpdate: (partial: Partial<SlotDefinition>) => void;
  onDelete: () => void;
  onRename?: (newName: string) => void;
  /** Label for the delete button, e.g. "attribute", "slot", "override" */
  deleteLabel?: string;
  /** "full" shows all fields; "override" shows only fields valid for slot_usage */
  mode?: 'full' | 'override';
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
          {onRename && (
            <FieldRow label="Name">
              <TextInput
                value={slot.name}
                onChange={() => {}}
                onCommit={(v) => {
                  const newName = v.trim();
                  if (newName && newName !== slot.name) onRename(newName);
                }}
                monospace
              />
            </FieldRow>
          )}
          <FieldRow label="Description">
            <TextArea
              value={slot.description ?? ''}
              onChange={(v) => onUpdate({ description: v || undefined })}
              placeholder="Optional…"
            />
          </FieldRow>
          <FieldRow label="Range">
            <FilteredGroupedSelect
              value={slot.range ?? ''}
              onChange={(v) => onUpdate({ range: v || undefined })}
              groups={rangeOptionGroups}
              placeholder="(none)"
            />
          </FieldRow>
          <FieldRow label="Tier 1 flags">
            <div>
              <Checkbox label="required" checked={!!slot.required} onChange={(v) => onUpdate({ required: v || undefined })} />
              <Checkbox label="multivalued" checked={!!slot.multivalued} onChange={(v) => onUpdate({ multivalued: v || undefined })} />
              {mode === 'full' && (
                <Checkbox label="identifier" checked={!!slot.identifier} onChange={(v) => onUpdate({ identifier: v || undefined })} />
              )}
            </div>
          </FieldRow>
          <FieldRow label="Tier 2 flags">
            <div>
              <Checkbox label="recommended" checked={!!slot.recommended} onChange={(v) => onUpdate({ recommended: v || undefined })} />
              {mode === 'full' && (
                <Checkbox label="inlined" checked={!!slot.inlined} onChange={(v) => onUpdate({ inlined: v || undefined })} />
              )}
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
          {mode === 'full' && (
            <FieldRow label="slot_uri">
              <TextInput
                value={slot.slotUri ?? ''}
                onChange={(v) => onUpdate({ slotUri: v || undefined })}
                placeholder="e.g. schema:name"
                monospace
              />
            </FieldRow>
          )}
          <div style={styles.slotEditorActions}>
            <DeleteButton label={deleteLabel} onConfirm={onDelete} />
          </div>
        </div>
      )}
    </div>
  );
}

function EnumPanel({ schemaId, enumName }: { schemaId: string; enumName: string }) {
  const schema = useAppStore((s) => s.getActiveSchema())?.schema;
  const updateEnum = useAppStore((s) => s.updateEnum);
  const renameEnum = useAppStore((s) => s.renameEnum);
  const addPermissibleValue = useAppStore((s) => s.addPermissibleValue);
  const updatePermissibleValue = useAppStore((s) => s.updatePermissibleValue);
  const deletePermissibleValue = useAppStore((s) => s.deletePermissibleValue);
  const deleteEnum = useAppStore((s) => s.deleteEnum);
  const setActiveEntity = useAppStore((s) => s.setActiveEntity);

  const [newValue, setNewValue] = useState('');

  const enumDef = schema?.enums[enumName] as EnumDefinition | undefined;
  if (!enumDef) return <EmptyPanel message="Enum not found" />;
  const enm = enumDef;

  const update = (partial: Partial<EnumDefinition>) => updateEnum(schemaId, enumName, partial);

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
        <TextInput
          value={enumDef.name}
          onChange={() => {}}
          onCommit={(v) => {
            const newName = v.trim();
            if (newName && newName !== enumName && !schema?.enums[newName]) {
              renameEnum(schemaId, enumName, newName);
              setActiveEntity({ type: 'enum', enumName: newName });
            }
          }}
          monospace
        />
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

function SchemaSlotInlineEditor({
  slot,
  schemaSlots,
  rangeOptionGroups,
  onUpdate,
  onDelete,
  onRename,
}: {
  slot: SlotDefinition;
  schemaSlots: Record<string, SlotDefinition>;
  rangeOptionGroups: OptionGroup[];
  onUpdate: (partial: Partial<SlotDefinition>) => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
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
          <FieldRow label="Name">
            <TextInput
              value={slot.name}
              onChange={() => {}}
              onCommit={(v) => {
                const newName = v.trim();
                if (newName && newName !== slot.name && !schemaSlots[newName]) onRename(newName);
              }}
              monospace
            />
          </FieldRow>
          <FieldRow label="Description">
            <TextArea
              value={slot.description ?? ''}
              onChange={(v) => onUpdate({ description: v || undefined })}
              placeholder="Optional…"
            />
          </FieldRow>
          <FieldRow label="Range">
            <FilteredGroupedSelect
              value={slot.range ?? ''}
              onChange={(v) => onUpdate({ range: v || undefined })}
              groups={rangeOptionGroups}
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
            <DeleteButton label="slot" onConfirm={onDelete} />
          </div>
        </div>
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
          style={{ ...styles.input, flex: 1 }}
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
            ✕
          </button>
        </div>
      ))}

      <div style={styles.addRow}>
        <input
          style={{ ...styles.input, ...styles.inputMono, flex: 1 }}
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
  readOnlyNotice: {
    padding: '5px 12px',
    background: '#0f1a2e',
    borderBottom: '1px solid #334155',
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#64748b',
    letterSpacing: 0.4,
    flexShrink: 0,
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
  importRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 12px',
  },
  importPath: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#94a3b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  importRemoveBtn: {
    background: 'transparent',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    padding: '1px 4px',
    fontSize: 11,
    borderRadius: 3,
    flexShrink: 0,
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
  editableBadge: {
    margin: '4px 12px',
    display: 'inline-block',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 600,
    color: '#86efac',
    background: '#064e3b',
    border: '1px solid #065f46',
    borderRadius: 4,
    padding: '1px 6px',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  edgeDescription: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'sans-serif',
    fontStyle: 'italic',
    lineHeight: 1.4,
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
  slotRefRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 12px',
    borderBottom: '1px solid #1e293b',
  },
  slotRefName: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#7dd3fc',
    flex: '0 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  slotRefRange: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#86efac',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  slotRefMissing: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#fbbf24',
    flex: 1,
  },
  slotRefRemoveBtn: {
    background: 'transparent',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    padding: '1px 4px',
    fontSize: 11,
    borderRadius: 3,
    flexShrink: 0,
  },
};
