/**
 * SignInPrompt — non-intrusive banner shown when the user is not signed in.
 *
 * Appears below the header. User can dismiss it and continue working locally.
 * When CLIENT_ID is not configured, the banner is not shown.
 */
import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { DeviceFlowModal } from './DeviceFlowModal.js';
import { X } from 'lucide-react';

const CLIENT_ID = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_GITHUB_CLIENT_ID ?? '';

export function SignInPrompt() {
  const { session, loading, startSignIn, deviceFlow, cancelSignIn } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Don't render if: loading, signed in, dismissed, or client_id not configured
  if (loading || session || dismissed || !CLIENT_ID) return null;

  return (
    <>
      <div style={styles.banner}>
        <div style={styles.content}>
          <span style={styles.icon}>☁</span>
          <span style={styles.message}>
            Sign in with GitHub to save your work to the cloud
          </span>
          <button style={styles.signInBtn} onClick={startSignIn}>
            Sign In
          </button>
          <button style={styles.dismissBtn} onClick={() => setDismissed(true)} title="Dismiss">
            <X size={14} />
          </button>
        </div>
      </div>

      {deviceFlow && (
        <DeviceFlowModal
          deviceFlow={deviceFlow}
          onCancel={cancelSignIn}
        />
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    background: 'var(--color-bg-surface-sunken)',
    borderBottom: '1px solid var(--color-accent-active)',
    padding: '6px 16px',
    flexShrink: 0,
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 12,
    color: 'var(--color-state-info-fg)',
  },
  icon: {
    fontSize: 14,
    color: 'var(--color-accent-hover)',
  },
  message: {
    flex: 1,
    color: 'var(--color-state-info-fg)',
  },
  signInBtn: {
    background: 'var(--color-accent-active)',
    border: '1px solid var(--color-border-focus)',
    color: 'var(--color-fg-on-accent)',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 11,
    cursor: 'pointer',
  },
  dismissBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-accent-hover)',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 4px',
    opacity: 0.7,
    lineHeight: 1,
  },
};
