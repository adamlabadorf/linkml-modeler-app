import { useState } from 'react';
import type { SlotDefinition } from '../../model/index.js';
import { FieldRow, TextInput, TextArea, Checkbox, FilteredGroupedSelect } from '../../ui/fields/index.js';
import type { OptionGroup } from '../../ui/fields/index.js';
import { DeleteButton } from './internal.js';
import { styles } from './styles.js';

export function SlotInlineEditor({
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
      <button type="button" style={styles.slotEditorHeader} onClick={() => setExpanded((v) => !v)}>
        <span style={styles.slotEditorToggle}>{expanded ? '▾' : '▸'}</span>
        <span style={styles.slotEditorName}>{slot.name}</span>
        {slot.range && <span style={styles.slotEditorRange}>: {slot.range}</span>}
        <div style={styles.slotEditorBadges}>
          {slot.required && <span style={styles.slotBadge}>R</span>}
          {slot.multivalued && <span style={styles.slotBadge}>M</span>}
          {slot.identifier && <span style={styles.slotBadge}>id</span>}
        </div>
      </button>

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
