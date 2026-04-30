/**
 * SyncStatusIndicator — shows cloud sync state in the status bar.
 *
 * Only renders when the app is in CloudPlatform mode (syncStatus !== null).
 * States:
 *   saved     → "✓ Saved"   (muted green)
 *   syncing   → "⟳ Syncing…" (blue)
 *   unsaved   → "● Unsaved changes" (amber)
 *   error     → AlertTriangle + "Sync error" (red)
 */
import React from 'react';
import { useAppStore, type SyncStatus } from '@linkml-editor/core';
import { AlertTriangle } from 'lucide-react';

export function SyncStatusIndicator() {
  const syncStatus = useAppStore((s) => s.syncStatus);

  if (!syncStatus) return null;

  const { label, color } = STATUS_CONFIG[syncStatus];

  return (
    <span style={{ ...styles.badge, color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {label}
    </span>
  );
}

const STATUS_CONFIG: Record<NonNullable<SyncStatus>, { label: React.ReactNode; color: string }> = {
  saved: { label: '✓ Saved', color: 'var(--color-state-success)' },
  syncing: { label: '⟳ Syncing…', color: 'var(--color-state-info)' },
  unsaved: { label: '● Unsaved changes', color: 'var(--color-state-warning)' },
  error: { label: <><AlertTriangle size={11} />Sync error</>, color: 'var(--color-state-error)' },
};

const styles: Record<string, React.CSSProperties> = {
  badge: {
    fontSize: 11,
    letterSpacing: '0.01em',
  },
};
