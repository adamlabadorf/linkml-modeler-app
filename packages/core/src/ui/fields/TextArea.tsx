import React from 'react';
import { useFieldId } from './FieldRow.js';

export function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const fieldId = useFieldId();
  return (
    <textarea
      id={fieldId || undefined}
      style={textareaStyle}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
    />
  );
}

const textareaStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 4,
  color: 'var(--color-fg-primary)',
  fontSize: 12,
  padding: '4px 7px',
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
  fontFamily: 'sans-serif',
};
