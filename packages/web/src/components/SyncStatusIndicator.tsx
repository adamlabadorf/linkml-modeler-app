/**
 * SyncStatusIndicator — shows cloud sync state in the status bar.
 *
 * Only renders when the app is in CloudPlatform mode (syncStatus !== null).
 * States:
 *   saved     → "✓ Saved"   (muted green)
 *   syncing   → "⟳ Syncing…" (blue)
 *   unsaved   → "● Unsaved changes" (amber)
 *   error     → "⚠ Sync error" (red) with retry action
 */
import React from 'react';
import { useAppStore, type SyncStatus } from '@linkml-editor/core';

export function SyncStatusIndicator() {
  const syncStatus = useAppStore((s) => s.syncStatus);

  if (!syncStatus) return null;

  const { label, color } = STATUS_CONFIG[syncStatus];

  return (
    <span style={{ ...styles.badge, color }}>
      {label}
    </span>
  );
}

const STATUS_CONFIG: Record<NonNullable<SyncStatus>, { label: string; color: string }> = {
  saved: { label: '✓ Saved', color: '#4ade80' },
  syncing: { label: '⟳ Syncing…', color: '#60a5fa' },
  unsaved: { label: '● Unsaved changes', color: '#f59e0b' },
  error: { label: '⚠ Sync error', color: '#f87171' },
};

const styles: Record<string, React.CSSProperties> = {
  badge: {
    fontSize: 11,
    letterSpacing: '0.01em',
  },
};
