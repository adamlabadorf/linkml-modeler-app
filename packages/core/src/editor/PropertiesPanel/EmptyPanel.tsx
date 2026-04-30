import React from 'react';
import { styles } from './styles.js';

export function EmptyPanel({ message }: { message?: string }) {
  return (
    <div style={styles.emptyPanel}>
      <p style={styles.emptyMessage}>{message ?? 'Select an element on the canvas'}</p>
      <p style={styles.emptyHint}>
        Click a class or enum node, or select an edge to edit its properties.
      </p>
    </div>
  );
}
