import React from 'react';

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={checkboxRowStyle}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        style={checkboxStyle}
      />
      <span>{label}</span>
    </label>
  );
}

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  color: 'var(--color-fg-secondary)',
  cursor: 'pointer',
  padding: '2px 0',
};

const checkboxStyle: React.CSSProperties = {
  accentColor: 'var(--color-accent-default)',
};
