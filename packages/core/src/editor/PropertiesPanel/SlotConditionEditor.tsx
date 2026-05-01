import type { SlotCondition } from '../../model/index.js';
import { Checkbox } from '../../ui/fields/index.js';
import { inputStyle, selectStyle } from '../../ui/fields/TextInput.js';
import { X } from '../../ui/icons/index.js';
import { styles } from './styles.js';

export function SlotConditionEditor({
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
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 11, color: 'var(--color-state-success-fg)', flex: 1 }}>{slotName}</span>
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
