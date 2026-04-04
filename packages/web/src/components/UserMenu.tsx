/**
 * UserMenu — shown in the app header when the user is signed in.
 *
 * Displays the GitHub avatar and username. Clicking opens a dropdown with:
 *   - "Signed in as @username" (non-interactive)
 *   - "Sign Out"
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { DeviceFlowModal } from './DeviceFlowModal.js';
import { GitHubProjectDialog } from './GitHubProjectDialog.js';
import { AppSettingsDialog } from './AppSettingsDialog.js';

const CLIENT_ID = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_GITHUB_CLIENT_ID ?? '';

export function UserMenu() {
  const { session, loading, startSignIn, deviceFlow, cancelSignIn, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleOutside);
      return () => document.removeEventListener('mousedown', handleOutside);
    }
  }, [open]);

  const handleSignOut = useCallback(async () => {
    setOpen(false);
    await signOut();
  }, [signOut]);

  if (loading) return null;

  // Unauthenticated: show compact sign-in button (only if CLIENT_ID configured)
  if (!session) {
    if (!CLIENT_ID) return null;
    return (
      <>
        <button style={styles.signInBtn} onClick={startSignIn}>
          Sign in
        </button>
        {deviceFlow && (
          <DeviceFlowModal deviceFlow={deviceFlow} onCancel={cancelSignIn} />
        )}
      </>
    );
  }

  // Authenticated: show avatar + dropdown
  return (
    <div ref={menuRef} style={styles.container}>
      <button
        style={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        title={`Signed in as @${session.login}`}
      >
        <img
          src={session.avatarUrl}
          alt={session.login}
          style={styles.avatar}
          referrerPolicy="no-referrer"
        />
        <span style={styles.login}>@{session.login}</span>
        <span style={styles.caret}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{session.name ?? session.login}</div>
            <div style={styles.userHandle}>@{session.login}</div>
          </div>
          <div style={styles.divider} />
          <button
            style={styles.menuItem}
            onClick={() => { setOpen(false); setProjectDialogOpen(true); }}
          >
            GitHub Projects…
          </button>
          <button
            style={styles.menuItem}
            onClick={() => { setOpen(false); setSettingsOpen(true); }}
          >
            Settings…
          </button>
          <div style={styles.divider} />
          <button style={styles.menuItem} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      )}

      {projectDialogOpen && (
        <GitHubProjectDialog onClose={() => setProjectDialogOpen(false)} />
      )}
      {settingsOpen && (
        <AppSettingsDialog onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    border: '1px solid #1e293b',
    borderRadius: 5,
    color: '#e2e8f0',
    padding: '3px 8px',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    display: 'block',
  },
  login: {
    color: '#94a3b8',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  caret: {
    fontSize: 8,
    color: '#475569',
    marginLeft: 2,
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    background: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: 6,
    minWidth: 180,
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    zIndex: 4000,
    overflow: 'hidden',
    fontFamily: 'monospace',
  },
  userInfo: {
    padding: '10px 14px',
  },
  userName: {
    fontSize: 13,
    color: '#e2e8f0',
    fontWeight: 600,
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 11,
    color: '#64748b',
  },
  divider: {
    height: 1,
    background: '#1e293b',
    margin: 0,
  },
  menuItem: {
    display: 'block',
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#e2e8f0',
    textAlign: 'left',
    padding: '8px 14px',
    fontSize: 12,
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
  signInBtn: {
    background: 'transparent',
    border: '1px solid #1d4ed8',
    color: '#60a5fa',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 11,
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
};
