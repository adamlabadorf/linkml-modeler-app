/**
 * CloneDialog — lets users clone a git repository by URL.
 *
 * Fields: Repository URL (HTTPS), optional branch, optional credentials.
 * Shows progress during clone, then opens the cloned project.
 */
import React from 'react';
import { usePlatform } from '../platform/PlatformContext.js';
import { useAppStore } from '../store/index.js';
import { openProjectFromDirectory } from '../project/projectLoader.js';

interface CloneDialogProps {
  onClose: () => void;
}

type CloneState = 'idle' | 'cloning' | 'opening' | 'done' | 'error';

export function CloneDialog({ onClose }: CloneDialogProps) {
  const platform = usePlatform();
  const setProject = useAppStore((s) => s.setProject);
  const setGitAvailable = useAppStore((s) => s.setGitAvailable);
  const pushToast = useAppStore((s) => s.pushToast);
  const setHiddenSchemaIds = useAppStore((s) => s.setHiddenSchemaIds);

  const [url, setUrl] = React.useState('');
  const [branch, setBranch] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showCredentials, setShowCredentials] = React.useState(false);
  const [state, setState] = React.useState<CloneState>('idle');
  const [progress, setProgress] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');

  const isValidUrl = /^https?:\/\/.+/.test(url.trim());

  const handleClone = async () => {
    if (!isValidUrl) return;

    setState('cloning');
    setProgress('Initializing clone...');
    setErrorMsg('');

    // Derive repo name from URL for destination path
    const repoName = url.trim().split('/').pop()?.replace(/\.git$/, '') || 'cloned-repo';
    const projectsDir = await platform.getProjectsPath();
    const destPath = `${projectsDir}/${repoName}-${Date.now()}`;

    const credentials = showCredentials && username
      ? { username, password }
      : undefined;

    const result = await platform.gitClone(url.trim(), destPath, {
      branch: branch.trim() || undefined,
      credentials,
      onProgress: (phase, loaded, total) => {
        if (total > 0) {
          setProgress(`${phase}: ${loaded}/${total}`);
        } else {
          setProgress(`${phase}: ${loaded}`);
        }
      },
    });

    if (!result.ok) {
      setState('error');
      setErrorMsg(result.error ?? 'Clone failed');
      return;
    }

    // Open the cloned directory as a project
    setState('opening');
    setProgress('Scanning for LinkML schemas...');

    try {
      const { project, hiddenSchemaIds } = await openProjectFromDirectory(result.destPath, platform);
      if (project.schemas.length === 0) {
        pushToast({ message: 'Repository cloned but no LinkML schemas found', severity: 'warning' });
      }
      // Set source to 'git' for recent projects tracking
      project.rootPath = result.destPath;
      setProject(project);
      setHiddenSchemaIds(hiddenSchemaIds);
      setGitAvailable(true);
      pushToast({ message: `Cloned ${repoName} successfully`, severity: 'success', durationMs: 3000 });
      onClose();
    } catch (err) {
      setState('error');
      setErrorMsg(`Clone succeeded but failed to open project: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValidUrl && state === 'idle') {
      handleClone();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const isBusy = state === 'cloning' || state === 'opening';

  return (
    <div style={ds.overlay} onClick={isBusy ? undefined : onClose}>
      <div style={ds.dialog} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <h2 style={ds.title}>Clone Repository</h2>

        {/* Repository URL */}
        <label style={ds.label}>Repository URL (HTTPS)</label>
        <input
          style={ds.input}
          type="url"
          placeholder="https://github.com/user/repo.git"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isBusy}
          autoFocus
        />

        {/* Branch */}
        <label style={ds.label}>Branch (optional)</label>
        <input
          style={ds.input}
          type="text"
          placeholder="main"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          disabled={isBusy}
        />

        {/* Credentials toggle */}
        <button
          style={ds.credToggle}
          onClick={() => setShowCredentials(!showCredentials)}
          disabled={isBusy}
          type="button"
        >
          {showCredentials ? '- Hide credentials' : '+ Add credentials (private repos)'}
        </button>

        {showCredentials && (
          <>
            <label style={ds.label}>Username</label>
            <input
              style={ds.input}
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isBusy}
            />
            <label style={ds.label}>Token / Password</label>
            <input
              style={ds.input}
              type="password"
              placeholder="ghp_... or password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isBusy}
            />
          </>
        )}

        {/* Progress / Error */}
        {isBusy && (
          <div style={ds.progressBar}>
            <div style={ds.spinner} />
            <span style={ds.progressText}>{progress}</span>
          </div>
        )}

        {state === 'error' && (
          <div style={ds.errorBox}>{errorMsg}</div>
        )}

        {/* Actions */}
        <div style={ds.actions}>
          <button style={ds.cancelBtn} onClick={onClose} disabled={isBusy}>
            Cancel
          </button>
          <button
            style={{
              ...ds.cloneBtn,
              ...(!isValidUrl || isBusy ? ds.cloneBtnDisabled : {}),
            }}
            onClick={handleClone}
            disabled={!isValidUrl || isBusy}
          >
            {isBusy ? 'Cloning...' : 'Clone'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const ds: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
  },
  dialog: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '24px',
    maxWidth: 460,
    width: '90%',
    color: '#e2e8f0',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    marginTop: 0,
    marginBottom: 16,
    color: '#60a5fa',
  },
  label: {
    display: 'block',
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 5,
    color: '#e2e8f0',
    fontSize: 13,
    fontFamily: 'var(--font-family-mono)',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  credToggle: {
    display: 'inline-block',
    marginTop: 12,
    background: 'transparent',
    border: 'none',
    color: '#60a5fa',
    fontSize: 11,
    cursor: 'pointer',
    padding: 0,
  },
  progressBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: '8px 10px',
    background: '#0f172a',
    borderRadius: 5,
    border: '1px solid #334155',
  },
  spinner: {
    width: 14,
    height: 14,
    border: '2px solid #334155',
    borderTop: '2px solid #60a5fa',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    flexShrink: 0,
  },
  progressText: {
    fontSize: 11,
    color: '#94a3b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  errorBox: {
    marginTop: 12,
    padding: '8px 10px',
    background: '#450a0a',
    border: '1px solid #7f1d1d',
    borderRadius: 5,
    color: '#fca5a5',
    fontSize: 12,
    wordBreak: 'break-word',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 20,
  },
  cancelBtn: {
    background: '#334155',
    border: '1px solid #475569',
    color: '#e2e8f0',
    borderRadius: 5,
    padding: '6px 16px',
    fontSize: 12,
    cursor: 'pointer',
  },
  cloneBtn: {
    background: '#2563eb',
    border: '1px solid #3b82f6',
    color: '#ffffff',
    borderRadius: 5,
    padding: '6px 20px',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
  },
  cloneBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};
