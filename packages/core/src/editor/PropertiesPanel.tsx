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
import { styles } from './PropertiesPanel/styles.js';

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

// ─── Rule editor components ───────────────────────────────────────────────────

function SlotConditionEditor({
  slotName,
  cond,
  onChange,
  onRemove,
}: {
  slotName: string;
  cond: SlotCondition;
  onChange: (c: SlotCondition) => void;
  onRemove: () => void;
}) {
  const upd = (p: Partial<SlotCondition>) => onChange({ ...cond, ...p });
  return (
    <div style={{ borderLeft: '2px solid #1e3a5f', marginLeft: 8, paddingLeft: 8, paddingBottom: 4, marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11, color: '#86efac', flex: 1 }}>{slotName}</span>
        <button style={styles.slotRefRemoveBtn} onClick={onRemove} title="Remove slot condition"><X size={12} /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <input
          style={{ ...inputStyle, fontSize: 11 }}
          placeholder="equals_string…"
          value={cond.equalsString ?? ''}
          onChange={e => upd({ equalsString: e.target.value || undefined })}
        />
        <input
          style={{ ...inputStyle, fontSize: 11, fontFamily: 'var(--font-family-mono)' }}
          placeholder="pattern (regex)…"
          value={cond.pattern ?? ''}
          onChange={e => upd({ pattern: e.target.value || undefined })}
        />
        <select
          style={{ ...selectStyle, fontSize: 11 }}
          value={cond.valuePresence ?? ''}
          onChange={e => upd({ valuePresence: (e.target.value as 'PRESENT' | 'ABSENT') || undefined })}
        >
          <option value="">value_presence: —</option>
          <option value="PRESENT">PRESENT</option>
          <option value="ABSENT">ABSENT</option>
        </select>
        <Checkbox label="required" checked={!!cond.required} onChange={v => upd({ required: v || undefined })} />
      </div>
    </div>
  );
}

function ClassExpressionEditor({
  label,
  expr,
  onChange,
}: {
  label: string;
  expr: AnonymousClassExpression;
  onChange: (e: AnonymousClassExpression) => void;
}) {
  const [newSlotName, setNewSlotName] = useState('');
  const slotConds = expr.slotConditions ?? {};

  const updateSlotConditions = (sc: Record<string, SlotCondition>) => {
    onChange({ ...expr, slotConditions: Object.keys(sc).length > 0 ? sc : undefined });
  };

  const handleAddSlot = () => {
    const name = newSlotName.trim();
    if (!name || slotConds[name]) return;
    updateSlotConditions({ ...slotConds, [name]: {} });
    setNewSlotName('');
  };

  return (
    <div style={{ paddingBottom: 4 }}>
      <div style={{ fontSize: 10, color: '#94a3b8', padding: '4px 12px',
        textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ paddingLeft: 8, paddingRight: 8 }}>
        {Object.entries(slotConds).map(([slotName, cond]) => (
          <SlotConditionEditor
            key={slotName}
            slotName={slotName}
            cond={cond}
            onChange={c => updateSlotConditions({ ...slotConds, [slotName]: c })}
            onRemove={() => {
              const { [slotName]: _removed, ...rest } = slotConds;
              updateSlotConditions(rest);
            }}
          />
        ))}
        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
          <input
            style={{ ...inputStyle, fontSize: 11, flex: 1 }}
            placeholder="slot name…"
            value={newSlotName}
            onChange={e => setNewSlotName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSlot()}
          />
          <button
            style={styles.btnPrimary}
            onClick={handleAddSlot}
            disabled={!newSlotName.trim() || !!slotConds[newSlotName.trim()]}
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleEditor({
  rule,
  ruleIndex,
  onChange,
  onDelete,
}: {
  rule: ClassRule;
  ruleIndex: number;
  onChange: (r: ClassRule) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const upd = (p: Partial<ClassRule>) => onChange({ ...rule, ...p });
  const label = rule.title || rule.description || `Rule ${ruleIndex + 1}`;

  const exprHasContent = (e: AnonymousClassExpression) =>
    (e.slotConditions && Object.keys(e.slotConditions).length > 0) ||
    e.anyOf?.length || e.allOf?.length || e.exactlyOneOf?.length || e.noneOf?.length || e.isA;

  return (
    <div style={styles.slotEditor}>
      <div style={styles.slotEditorHeader} onClick={() => setExpanded(x => !x)}>
        <span style={styles.slotEditorToggle}>{expanded ? '▾' : '▸'}</span>
        <span style={{ ...styles.slotEditorName, flex: 1 }} title={label}>{label}</span>
        <div style={styles.slotEditorBadges}>
          {rule.deactivated && <span style={styles.slotBadge}>off</span>}
          {rule.bidirectional && <span style={styles.slotBadge}>bidir</span>}
        </div>
      </div>
      {expanded && (
        <div style={styles.slotEditorBody}>
          <FieldRow label="Title">
            <TextInput value={rule.title ?? ''} onChange={v => upd({ title: v || undefined })} placeholder="rule title…" />
          </FieldRow>
          <FieldRow label="Description">
            <TextArea value={rule.description ?? ''} onChange={v => upd({ description: v || undefined })} placeholder="rule description…" />
          </FieldRow>
          <FieldRow label="Rank">
            <input
              style={{ ...inputStyle, width: 80 }}
              type="number"
              value={rule.rank ?? ''}
              placeholder="—"
              onChange={e => upd({ rank: e.target.value !== '' ? parseInt(e.target.value) : undefined })}
            />
          </FieldRow>
          <FieldRow label="Flags">
            <div>
              <Checkbox label="bidirectional" checked={!!rule.bidirectional} onChange={v => upd({ bidirectional: v || undefined })} />
              <Checkbox label="open_world" checked={!!rule.openWorld} onChange={v => upd({ openWorld: v || undefined })} />
              <Checkbox label="deactivated" checked={!!rule.deactivated} onChange={v => upd({ deactivated: v || undefined })} />
            </div>
          </FieldRow>
          <ClassExpressionEditor
            label="IF (preconditions)"
            expr={rule.preconditions ?? {}}
            onChange={e => upd({ preconditions: exprHasContent(e) ? e : undefined })}
          />
          <ClassExpressionEditor
            label="THEN (postconditions)"
            expr={rule.postconditions ?? {}}
            onChange={e => upd({ postconditions: exprHasContent(e) ? e : undefined })}
          />
          <ClassExpressionEditor
            label="ELSE (else-conditions)"
            expr={rule.elseconditions ?? {}}
            onChange={e => upd({ elseconditions: exprHasContent(e) ? e : undefined })}
          />
          <div style={styles.slotEditorActions}>
            <DeleteButton label="rule" onConfirm={onDelete} />
          </div>
        </div>
      )}
    </div>
  );
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
  const addMixinToClass = useAppStore((s) => s.addMixinToClass);
  const removeMixinFromClass = useAppStore((s) => s.removeMixinFromClass);
  const addSlotReferenceToClass = useAppStore((s) => s.addSlotReferenceToClass);
  const removeSlotReferenceFromClass = useAppStore((s) => s.removeSlotReferenceFromClass);
  const updateSlotUsage = useAppStore((s) => s.updateSlotUsage);
  const deleteSlotUsage = useAppStore((s) => s.deleteSlotUsage);
  const allSchemas = useAppStore((s) => s.activeProject?.schemas ?? []);

  const rangeOptionGroups = useRangeOptionGroups(schemaId, className);
  const isAOptionGroups = useIsAOptionGroups(className);
  const schemaSlotOptionGroups = useSchemaSlotOptionGroups();
  const [newMixinName, setNewMixinName] = useState('');
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

  function handleAddMixin() {
    const name = newMixinName.trim();
    if (!name || cls.mixins.includes(name)) return;
    addMixinToClass(schemaId, className, name);
    setNewMixinName('');
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
          clearable
        />
      </FieldRow>

      <FieldRow label="mixins">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {cls.mixins.map((mixinName) => (
            <div key={mixinName} style={styles.slotRefRow}>
              <span style={styles.slotRefName}>{mixinName}</span>
              <button
                style={styles.slotRefRemoveBtn}
                onClick={() => removeMixinFromClass(schemaId, className, mixinName)}
                title="Remove mixin"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <div style={styles.addRow}>
            <div style={{ flex: 1 }}>
              <FilteredGroupedSelect
                value={newMixinName}
                onChange={(v) => setNewMixinName(v)}
                groups={isAOptionGroups}
                placeholder="add mixin…"
              />
            </div>
            <button style={styles.btnPrimary} onClick={handleAddMixin} disabled={!newMixinName.trim()}>
              + Add
            </button>
          </div>
        </div>
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
          deleteLabel="attribute"
        />
      ))}

      <div style={styles.addRow}>
        <input
          style={{ ...inputStyle, flex: 1 }}
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
              <span style={{ ...styles.slotRefMissing, display: 'flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={11} /> not found</span>
            )}
            <button
              style={styles.slotRefRemoveBtn}
              onClick={() => removeSlotReferenceFromClass(schemaId, className, slotName)}
              title="Remove slot reference"
            >
              <X size={12} />
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

      <SectionHeader title="Rules" />

      {(cls.rules ?? []).map((rule, idx) => (
        <RuleEditor
          key={idx}
          rule={rule}
          ruleIndex={idx}
          onChange={updated => {
            const newRules = [...(cls.rules ?? [])];
            newRules[idx] = updated;
            update({ rules: newRules });
          }}
          onDelete={() => {
            const newRules = (cls.rules ?? []).filter((_, i) => i !== idx);
            update({ rules: newRules.length > 0 ? newRules : undefined });
          }}
        />
      ))}

      <div style={styles.addRow}>
        <button
          style={styles.btnPrimary}
          onClick={() => update({ rules: [...(cls.rules ?? []), {}] })}
        >
          + Add Rule
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
          style={{ ...inputStyle, flex: 1 }}
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

