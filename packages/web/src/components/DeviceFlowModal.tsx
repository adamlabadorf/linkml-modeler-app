/**
 * DeviceFlowModal — shown while the user completes GitHub Device Flow auth.
 *
 * Displays the user code and a button to open GitHub in a new tab (or
 * via shell.openExternal in Electron). Shows a spinner while polling.
 * Shows error state if auth times out or fails.
 */
import React from 'react';
import type { DeviceFlowState } from '../auth/AuthContext.js';

interface Props {
  deviceFlow: DeviceFlowState;
  onCancel(): void;
}

// Detect Electron
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
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.title}>Sign in with GitHub</div>

        {status !== 'error' ? (
          <>
            <p style={styles.instruction}>
              Enter this code at GitHub to authorize:
            </p>
            <div style={styles.codeRow}>
              <span style={styles.code}>{userCode}</span>
              <button style={styles.copyBtn} onClick={copyCode} title="Copy code">
                Copy
              </button>
            </div>
            <button
              style={styles.openBtn}
              onClick={() => openUrl(verificationUri)}
            >
              Open GitHub ↗
            </button>
            <div style={styles.waiting}>
              <span style={styles.spinner}>⟳</span>
              Waiting for authorization…
            </div>
          </>
        ) : (
          <>
            <p style={styles.errorMsg}>{error}</p>
          </>
        )}

        <button style={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5000,
  },
  modal: {
    background: 'var(--color-bg-canvas)',
    border: '1px solid var(--color-state-info-bg)',
    borderRadius: 8,
    padding: '24px 28px',
    width: 380,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--color-fg-primary)',
  },
  instruction: {
    fontSize: 13,
    color: 'var(--color-fg-secondary)',
    margin: 0,
  },
  codeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-default)',
    borderRadius: 6,
    padding: '10px 14px',
  },
  code: {
    flex: 1,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: 'var(--color-accent-hover)',
    fontFamily: 'var(--font-family-mono)',
  },
  copyBtn: {
    background: 'var(--color-accent-active)',
    border: '1px solid var(--color-border-focus)',
    color: 'var(--color-fg-on-accent)',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 11,
    cursor: 'pointer',
  },
  openBtn: {
    background: 'var(--color-state-success-bg)',
    border: '1px solid var(--color-state-success-border)',
    color: 'var(--color-state-success-fg)',
    borderRadius: 5,
    padding: '8px 14px',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'center',
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
  cancelBtn: {
    background: 'transparent',
    border: '1px solid var(--color-border-default)',
    color: 'var(--color-fg-secondary)',
    borderRadius: 5,
    padding: '6px 14px',
    fontSize: 12,
    cursor: 'pointer',
    alignSelf: 'flex-end',
  },
};
