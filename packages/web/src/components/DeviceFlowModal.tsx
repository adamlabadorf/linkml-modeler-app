/**
 * DeviceFlowModal — shown while the user completes GitHub Device Flow auth.
 *
 * Displays the user code and a button to open GitHub in a new tab (or
 * via shell.openExternal in Electron). Shows a spinner while polling.
 * Shows error state if auth times out or fails.
 */
import React from 'react';
import type { DeviceFlowState } from '../auth/AuthContext.js';
import { Button, Dialog } from '@linkml-editor/core';

interface Props {
  deviceFlow: DeviceFlowState;
  onCancel(): void;
}

const IS_ELECTRON = typeof window !== 'undefined' && 'electronAPI' in window;

function openUrl(url: string) {
  if (IS_ELECTRON) {
    (window as unknown as { electronAPI: { openExternal(url: string): void } }).electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function DeviceFlowModal({ deviceFlow, onCancel }: Props) {
  const { userCode, verificationUri, status, error } = deviceFlow;

  const copyCode = () => {
    navigator.clipboard.writeText(userCode).catch(() => {});
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      title="Sign in with GitHub"
      size="sm"
      closeOnBackdrop={false}
      footer={
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      }
    >
      {status !== 'error' ? (
        <>
          <p style={styles.instruction}>
            Enter this code at GitHub to authorize:
          </p>
          <div style={styles.codeRow}>
            <span style={styles.code}>{userCode}</span>
            <Button variant="primary" size="sm" onClick={copyCode}>Copy</Button>
          </div>
          <button
            style={styles.openBtn}
            onClick={() => openUrl(verificationUri)}
            type="button"
          >
            Open GitHub ↗
          </button>
          <div style={styles.waiting}>
            <span style={styles.spinner}>⟳</span>
            Waiting for authorization…
          </div>
        </>
      ) : (
        <p style={styles.errorMsg}>{error}</p>
      )}
    </Dialog>
  );
}

const styles: Record<string, React.CSSProperties> = {
  instruction: {
    fontSize: 13,
    color: 'var(--color-fg-secondary)',
    margin: '0 0 12px',
  },
  codeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 6,
    padding: '10px 14px',
    marginBottom: 12,
  },
  code: {
    flex: 1,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: 'var(--color-accent-hover)',
    fontFamily: 'var(--font-family-mono)',
  },
  openBtn: {
    display: 'block',
    width: '100%',
    background: 'var(--color-state-success-bg)',
    border: '1px solid var(--color-state-success-border)',
    color: 'var(--color-state-success-fg)',
    borderRadius: 5,
    padding: '8px 14px',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'center',
    marginBottom: 12,
  },
  waiting: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: 'var(--color-fg-muted)',
  },
  spinner: {
    display: 'inline-block',
    animation: 'spin 1.2s linear infinite',
    fontSize: 16,
  },
  errorMsg: {
    fontSize: 13,
    color: 'var(--color-state-error-fg)',
    margin: 0,
    padding: '8px 12px',
    background: 'var(--color-state-error-bg)',
    border: '1px solid var(--color-state-error-border)',
    borderRadius: 5,
  },
};
