import React, { useState } from 'react';
import type { PermissibleValue } from '../../model/index.js';
import { FieldRow, TextInput, TextArea } from '../../ui/fields/index.js';
import { DeleteButton } from './internal.js';
import { styles } from './styles.js';

export function PermissibleValueEditor({
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
