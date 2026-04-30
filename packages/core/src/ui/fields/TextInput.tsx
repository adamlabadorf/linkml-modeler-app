import React from 'react';

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
};

export const inputMonoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family-mono)',
};

export const selectStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 4,
  color: '#e2e8f0',
  fontSize: 12,
  padding: '4px 7px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'var(--font-family-mono)',
};
