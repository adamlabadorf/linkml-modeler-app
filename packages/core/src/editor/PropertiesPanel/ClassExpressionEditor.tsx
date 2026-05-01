import { useState } from 'react';
import type { SlotCondition, AnonymousClassExpression } from '../../model/index.js';
import { inputStyle } from '../../ui/fields/TextInput.js';
import { SlotConditionEditor } from './SlotConditionEditor.js';
import { styles } from './styles.js';

export function ClassExpressionEditor({
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
      <div style={{ fontSize: 10, color: 'var(--color-fg-secondary)', padding: '4px 12px',
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
