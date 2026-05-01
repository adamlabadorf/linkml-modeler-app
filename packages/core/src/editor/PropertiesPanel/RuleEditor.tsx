import { useState } from 'react';
import type { ClassRule, AnonymousClassExpression } from '../../model/index.js';
import { FieldRow, TextInput, TextArea, Checkbox } from '../../ui/fields/index.js';
import { inputStyle } from '../../ui/fields/TextInput.js';
import { ClassExpressionEditor } from './ClassExpressionEditor.js';
import { DeleteButton } from './internal.js';
import { styles } from './styles.js';

export function RuleEditor({
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
      <button type="button" style={styles.slotEditorHeader} onClick={() => setExpanded(x => !x)}>
        <span style={styles.slotEditorToggle}>{expanded ? '▾' : '▸'}</span>
        <span style={{ ...styles.slotEditorName, flex: 1 }} title={label}>{label}</span>
        <div style={styles.slotEditorBadges}>
          {rule.deactivated && <span style={styles.slotBadge}>off</span>}
          {rule.bidirectional && <span style={styles.slotBadge}>bidir</span>}
        </div>
      </button>
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
