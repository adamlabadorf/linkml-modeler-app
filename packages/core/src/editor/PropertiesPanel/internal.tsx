import React, { useState } from 'react';
import { styles } from './styles.js';

export function SectionHeader({ title }: { title: string }) {
  return <div style={styles.sectionHeader}>{title}</div>;
}

export function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div style={styles.deleteConfirm}>
        <span style={styles.deleteConfirmText}>Delete {label}?</span>
        <button style={styles.btnDanger} onClick={onConfirm}>
          Confirm
        </button>
        <button style={styles.btnGhost} onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button style={styles.btnDanger} onClick={() => setConfirming(true)}>
      Delete {label}
    </button>
  );
}
