import React from 'react';

export function TextArea({
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
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
  fontFamily: 'sans-serif',
};
