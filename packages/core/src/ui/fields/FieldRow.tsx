import React from 'react';

export function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.fieldRow}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  fieldRow: {
    padding: '5px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  fieldLabel: {
    fontSize: 10,
    color: 'var(--color-fg-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
};
