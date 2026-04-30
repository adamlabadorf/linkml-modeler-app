/**
 * SignInPrompt — non-intrusive banner shown when the user is not signed in.
 *
 * Appears below the header. User can dismiss it and continue working locally.
 * When CLIENT_ID is not configured, the banner is not shown.
 */
import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { DeviceFlowModal } from './DeviceFlowModal.js';

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
            ✕
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
    background: '#0f2744',
    borderBottom: '1px solid #1d4ed8',
    padding: '6px 16px',
    flexShrink: 0,
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 12,
    color: '#93c5fd',
  },
  icon: {
    fontSize: 14,
    color: '#60a5fa',
  },
  message: {
    flex: 1,
    color: '#bfdbfe',
  },
  signInBtn: {
    background: '#1d4ed8',
    border: '1px solid #2563eb',
    color: '#eff6ff',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 11,
    cursor: 'pointer',
  },
  dismissBtn: {
    background: 'transparent',
    border: 'none',
    color: '#60a5fa',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 4px',
    opacity: 0.7,
    lineHeight: 1,
  },
};
