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
    background: '#0f172a',
    border: '1px solid #1e3a5f',
    borderRadius: 8,
    padding: '24px 28px',
    width: 380,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    fontFamily: 'monospace',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#e2e8f0',
  },
  instruction: {
    fontSize: 13,
    color: '#94a3b8',
    margin: 0,
  },
  codeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 6,
    padding: '10px 14px',
  },
  code: {
    flex: 1,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: '#60a5fa',
    fontFamily: 'monospace',
  },
  copyBtn: {
    background: '#1d4ed8',
    border: '1px solid #2563eb',
    color: '#eff6ff',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 11,
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
  openBtn: {
    background: '#166534',
    border: '1px solid #15803d',
    color: '#86efac',
    borderRadius: 5,
    padding: '8px 14px',
    fontSize: 13,
    fontFamily: 'monospace',
    cursor: 'pointer',
    textAlign: 'center',
  },
  waiting: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#64748b',
  },
  spinner: {
    display: 'inline-block',
    animation: 'spin 1.2s linear infinite',
    fontSize: 16,
  },
  errorMsg: {
    fontSize: 13,
    color: '#fca5a5',
    margin: 0,
    padding: '8px 12px',
    background: '#450a0a',
    border: '1px solid #7f1d1d',
    borderRadius: 5,
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 5,
    padding: '6px 14px',
    fontSize: 12,
    fontFamily: 'monospace',
    cursor: 'pointer',
    alignSelf: 'flex-end',
  },
};
