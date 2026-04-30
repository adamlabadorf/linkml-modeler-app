import React from 'react';
import { useFieldId } from './FieldRow.js';

export function TextInput({
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
  const fieldId = useFieldId();
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
      id={fieldId || undefined}
      style={{ ...inputStyle, ...(monospace ? inputMonoStyle : {}) }}
      value={committed ? (value ?? '') : localValue!}
      placeholder={placeholder}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

export const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 4,
  color: 'var(--color-fg-primary)',
  fontSize: 12,
  padding: '4px 7px',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'sans-serif',
};

export const inputMonoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family-mono)',
};

export const selectStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 4,
  color: 'var(--color-fg-primary)',
  fontSize: 12,
  padding: '4px 7px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'var(--font-family-mono)',
};
