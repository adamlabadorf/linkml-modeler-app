/**
 * GitPanel — M7 Git integration UI panel.
 *
 * Shows:
 *  - Current branch + branch switcher
 *  - Staging area: modified/untracked files with stage/unstage toggles
 *  - Commit message input + commit button
 *  - Push/pull buttons
 *  - Recent commit log (last 10)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useAppStore, usePlatform } from '@linkml-editor/core';

type Tab = 'changes' | 'log' | 'settings';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const sec = Math.floor((Date.now() - timestamp) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

// ── GitPanel ──────────────────────────────────────────────────────────────────

export function GitPanel({ onSaveBeforeCommit }: { onSaveBeforeCommit?: () => Promise<boolean> }) {
  const platform = usePlatform();
  const gitPanelOpen = useAppStore((s) => s.gitPanelOpen);
  const setGitPanelOpen = useAppStore((s) => s.setGitPanelOpen);
  const gitAvailable = useAppStore((s) => s.gitAvailable);
  const gitStatus = useAppStore((s) => s.gitStatus);
  const commitLog = useAppStore((s) => s.commitLog);
  const commitMessage = useAppStore((s) => s.commitMessage);
  const stagedPaths = useAppStore((s) => s.stagedPaths);
  const isCommitting = useAppStore((s) => s.isCommitting);
  const isPushing = useAppStore((s) => s.isPushing);
  const isPulling = useAppStore((s) => s.isPulling);
  const lastGitError = useAppStore((s) => s.lastGitError);
  const activeProject = useAppStore((s) => s.activeProject);

  const setGitStatus = useAppStore((s) => s.setGitStatus);
  const setCommitLog = useAppStore((s) => s.setCommitLog);
  const setCommitMessage = useAppStore((s) => s.setCommitMessage);
  const stageFile = useAppStore((s) => s.stageFile);
  const unstageFile = useAppStore((s) => s.unstageFile);
  const stageAll = useAppStore((s) => s.stageAll);
  const clearStaged = useAppStore((s) => s.clearStaged);
  const setIsCommitting = useAppStore((s) => s.setIsCommitting);
  const setIsPushing = useAppStore((s) => s.setIsPushing);
  const setIsPulling = useAppStore((s) => s.setIsPulling);
  const setLastGitError = useAppStore((s) => s.setLastGitError);
  const pushToast = useAppStore((s) => s.pushToast);
  const setGitAvailable = useAppStore((s) => s.setGitAvailable);
  const updateGitConfig = useAppStore((s) => s.updateGitConfig);

  const [tab, setTab] = useState<Tab>('changes');
  const [isInitializing, setIsInitializing] = useState(false);
  // Settings tab local state (mirrors gitConfig + stored credentials)
  const [remoteUrl, setRemoteUrl] = useState(activeProject?.gitConfig?.remoteUrl ?? '');
  const [authorName, setAuthorName] = useState(activeProject?.gitConfig?.userName ?? '');
  const [authorEmail, setAuthorEmail] = useState(activeProject?.gitConfig?.userEmail ?? '');
  const [gitUsername, setGitUsername] = useState('');
  const [gitToken, setGitToken] = useState('');

  // When project changes or git becomes available, sync settings from gitConfig
  // and fall back to reading from the actual git config + stored credentials.
  useEffect(() => {
    setRemoteUrl(activeProject?.gitConfig?.remoteUrl ?? '');
    setAuthorName(activeProject?.gitConfig?.userName ?? '');
    setAuthorEmail(activeProject?.gitConfig?.userEmail ?? '');

    if (!gitAvailable || !activeProject) return;
    const repoP = activeProject.rootPath;

    // Load stored credentials
    Promise.all([
      platform.getCredential('git-username'),
      platform.getCredential('git-token'),
    ]).then(([u, t]) => {
      if (u) setGitUsername(u);
      if (t) setGitToken(t);
    });

    // Fill any missing gitConfig fields from the actual git repo config
    platform.gitReadConfig(repoP).then((cfg) => {
      const updates: Record<string, string> = {};
      if (cfg.remoteUrl && !activeProject.gitConfig?.remoteUrl) {
        setRemoteUrl(cfg.remoteUrl);
        updates.remoteUrl = cfg.remoteUrl;
      }
      if (cfg.userName && !activeProject.gitConfig?.userName) {
        setAuthorName(cfg.userName);
        updates.userName = cfg.userName;
      }
      if (cfg.userEmail && !activeProject.gitConfig?.userEmail) {
        setAuthorEmail(cfg.userEmail);
        updates.userEmail = cfg.userEmail;
      }
      if (Object.keys(updates).length > 0) {
        updateGitConfig(updates);
      }
    });
  }, [activeProject?.id, gitAvailable]); // eslint-disable-line react-hooks/exhaustive-deps
  const [credentialPrompt, setCredentialPrompt] = useState<{
    url: string;
    resolve: (creds: { username: string; password: string } | null) => void;
  } | null>(null);
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const repoPath = activeProject?.rootPath ?? '/';

  // Refresh git status
  const refreshStatus = useCallback(async () => {
    if (!gitAvailable) return;
    const [status, log] = await Promise.all([
      platform.gitStatus(repoPath),
      platform.gitLog(repoPath, 10),
    ]);
    setGitStatus(status);
    setCommitLog(log);
  }, [gitAvailable, platform, repoPath, setGitStatus, setCommitLog]);

  useEffect(() => {
    if (gitPanelOpen && gitAvailable) {
      refreshStatus();
    }
  }, [gitPanelOpen, gitAvailable, refreshStatus]);

  // Auto-populate commit message template when panel opens with changes
  useEffect(() => {
    if (!gitPanelOpen || !gitStatus || commitMessage.trim()) return;
    const allFiles = [
      ...gitStatus.stagedFiles,
      ...gitStatus.unstagedFiles,
      ...gitStatus.untrackedFiles,
    ];
    if (allFiles.length === 0) return;

    // Derive template from changed file extensions/paths
    const yamlFiles = allFiles.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
    if (yamlFiles.length > 0) {
      const names = yamlFiles.map((f) => f.split('/').pop()).slice(0, 3);
      const suffix = yamlFiles.length > 3 ? ` and ${yamlFiles.length - 3} more` : '';
      setCommitMessage(`update schema: ${names.join(', ')}${suffix}`);
    }
  }, [gitPanelOpen, gitStatus, commitMessage, setCommitMessage]);

  const handleCommit = useCallback(async () => {
    if (!commitMessage.trim() || stagedPaths.size === 0) return;
    setIsCommitting(true);
    setLastGitError(null);
    try {
      // Save dirty schemas to disk before committing
      if (onSaveBeforeCommit) {
        const saved = await onSaveBeforeCommit();
        if (!saved) {
          pushToast({ message: 'Save failed — commit aborted', severity: 'warning' });
          setIsCommitting(false);
          return;
        }
        // Refresh status after save to pick up file changes
        await refreshStatus();
      }

      await platform.gitStage(repoPath, Array.from(stagedPaths));
      const author =
        activeProject?.gitConfig?.userName && activeProject?.gitConfig?.userEmail
          ? { name: activeProject.gitConfig.userName, email: activeProject.gitConfig.userEmail }
          : undefined;
      const oid = await platform.gitCommit(repoPath, commitMessage, author);
      if (oid) {
        setCommitMessage('');
        clearStaged();
        pushToast({ message: `Committed: ${oid.slice(0, 7)}`, severity: 'success' });
        await refreshStatus();
      } else {
        setLastGitError('Commit failed — no OID returned');
      }
    } catch (e: unknown) {
      setLastGitError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCommitting(false);
    }
  }, [
    commitMessage, stagedPaths, repoPath, platform, onSaveBeforeCommit,
    setIsCommitting, setLastGitError, setCommitMessage, clearStaged,
    pushToast, refreshStatus,
  ]);

  const requestCredentials = useCallback(async (url: string): Promise<{ username: string; password: string } | null> => {
    // Use stored credentials if available
    const [storedUser, storedToken] = await Promise.all([
      platform.getCredential('git-username'),
      platform.getCredential('git-token'),
    ]);
    if (storedUser && storedToken) {
      return { username: storedUser, password: storedToken };
    }
    // Fall back to interactive dialog
    return new Promise((resolve) => {
      setCredUsername('');
      setCredPassword('');
      setCredentialPrompt({ url, resolve });
    });
  }, [platform]);

  const handlePush = useCallback(async () => {
    if (!gitAvailable) return;
    setIsPushing(true);
    setLastGitError(null);
    try {
      const result = await platform.gitPush(repoPath, requestCredentials);
      if (result?.ok) {
        pushToast({ message: 'Pushed to remote', severity: 'success' });
        await refreshStatus();
      } else {
        setLastGitError(result?.error ?? 'Push failed');
      }
    } catch (e: unknown) {
      setLastGitError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsPushing(false);
    }
  }, [gitAvailable, repoPath, platform, requestCredentials, setIsPushing, setLastGitError, pushToast, refreshStatus]);

  const handlePull = useCallback(async () => {
    if (!gitAvailable) return;
    setIsPulling(true);
    setLastGitError(null);
    try {
      const result = await platform.gitPull(repoPath, requestCredentials);
      if (result?.ok) {
        pushToast({ message: 'Pulled from remote', severity: 'success' });
        await refreshStatus();
      } else {
        setLastGitError(result?.error ?? 'Pull failed');
      }
    } catch (e: unknown) {
      setLastGitError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsPulling(false);
    }
  }, [gitAvailable, repoPath, platform, requestCredentials, setIsPulling, setLastGitError, pushToast, refreshStatus]);

  if (!gitPanelOpen) {
    return (
      <div id="lme-git-panel" style={styles.collapsedBar} onClick={() => setGitPanelOpen(true)}>
        <span style={styles.collapsedLabel}>
          {gitStatus ? `⎇ ${gitStatus.branch}` : '⎇ Git'}
        </span>
        {gitStatus && gitStatus.aheadCount > 0 && (
          <span style={styles.aheadBadge}>↑{gitStatus.aheadCount}</span>
        )}
        {gitStatus &&
          gitStatus.stagedFiles.length + gitStatus.unstagedFiles.length + gitStatus.untrackedFiles.length > 0 && (
            <span style={styles.changeBadge}>
              {gitStatus.stagedFiles.length + gitStatus.unstagedFiles.length + gitStatus.untrackedFiles.length}
            </span>
          )}
        {commitLog.length > 0 && (
          <span style={styles.lastCommitHint}>
            {commitLog[0].oid.slice(0, 7)} {commitLog[0].message.split('\n')[0].slice(0, 40)}
          </span>
        )}
      </div>
    );
  }

  if (!gitAvailable) {
    const handleInitRepo = async () => {
      if (!activeProject) return;
      setIsInitializing(true);
      try {
        const ok = await platform.gitCreateRepo(repoPath);
        if (ok) {
          setGitAvailable(true);
          updateGitConfig({ enabled: true, defaultBranch: 'main' });
          pushToast({ message: 'Git repository initialized', severity: 'success' });
          await refreshStatus();
        } else {
          pushToast({ message: 'Failed to initialize git repository', severity: 'warning' });
        }
      } catch (e: unknown) {
        pushToast({ message: e instanceof Error ? e.message : 'Git init failed', severity: 'warning' });
      } finally {
        setIsInitializing(false);
      }
    };

    return (
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <span style={styles.panelTitle}>⎇ Git</span>
          <button style={styles.closeBtn} onClick={() => setGitPanelOpen(false)}>✕</button>
        </div>
        <div style={styles.noGit}>
          <div>No git repository found for this project.</div>
          <button
            style={{ ...styles.initBtn, ...(isInitializing ? styles.commitBtnDisabled : {}) }}
            onClick={handleInitRepo}
            disabled={isInitializing || !activeProject}
          >
            {isInitializing ? 'Initializing…' : '⎇ Initialize git repo'}
          </button>
        </div>
      </div>
    );
  }

  const allChanged = [
    ...(gitStatus?.stagedFiles ?? []),
    ...(gitStatus?.unstagedFiles ?? []),
    ...(gitStatus?.untrackedFiles ?? []),
  ];

  return (
    <div id="lme-git-panel" style={styles.panel}>
      {/* Header */}
      <div style={styles.panelHeader}>
        <span style={styles.panelTitle}>
          ⎇ {gitStatus?.branch ?? '…'}
          {gitStatus && gitStatus.aheadCount > 0 && (
            <span style={styles.headerAhead}> ↑{gitStatus.aheadCount}</span>
          )}
          {gitStatus && gitStatus.behindCount > 0 && (
            <span style={styles.headerBehind}> ↓{gitStatus.behindCount}</span>
          )}
        </span>
        <div style={styles.headerActions}>
          <button style={styles.headerBtn} onClick={refreshStatus} title="Refresh git status">
            ↻
          </button>
          {activeProject?.gitConfig?.remoteUrl && (
            <button
              style={{ ...styles.headerBtn, ...(isPulling ? styles.headerBtnDisabled : {}) }}
              onClick={handlePull}
              disabled={isPulling}
              title="Pull from remote"
            >
              {isPulling ? '…' : '↓ Pull'}
            </button>
          )}
          <button
            style={{ ...styles.headerBtn, ...(isPushing ? styles.headerBtnDisabled : {}) }}
            onClick={handlePush}
            disabled={isPushing}
            title="Push to remote"
          >
            {isPushing ? '…' : '↑ Push'}
          </button>
          <button style={styles.closeBtn} onClick={() => setGitPanelOpen(false)}>✕</button>
        </div>
      </div>

      {/* Error bar */}
      {lastGitError && (
        <div style={styles.errorBar}>
          <span>{lastGitError}</span>
          <button style={styles.errorDismiss} onClick={() => setLastGitError(null)}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabBar}>
        <button
          style={{ ...styles.tab, ...(tab === 'changes' ? styles.tabActive : {}) }}
          onClick={() => setTab('changes')}
        >
          Changes
          {allChanged.length > 0 && (
            <span style={styles.tabBadge}>{allChanged.length}</span>
          )}
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'log' ? styles.tabActive : {}) }}
          onClick={() => setTab('log')}
        >
          Log ({commitLog.length})
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'settings' ? styles.tabActive : {}) }}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
      </div>

      {tab === 'changes' && (
        <div style={styles.tabContent}>
          {/* Staged section */}
          {gitStatus && gitStatus.stagedFiles.length > 0 && (
            <>
              <div style={styles.sectionHeader}>
                Staged ({gitStatus.stagedFiles.length})
                <button style={styles.sectionBtn} onClick={clearStaged}>Unstage all</button>
              </div>
              {gitStatus.stagedFiles.map((f) => (
                <FileRow
                  key={f}
                  path={f}
                  staged={true}
                  onUnstage={() => unstageFile(f)}
                  onStage={() => stageFile(f)}
                />
              ))}
            </>
          )}

          {/* Unstaged / untracked */}
          {allChanged.filter((f) => !gitStatus?.stagedFiles.includes(f)).length > 0 && (
            <>
              <div style={styles.sectionHeader}>
                Unstaged
                <button style={styles.sectionBtn} onClick={stageAll}>Stage all</button>
              </div>
              {[...(gitStatus?.unstagedFiles ?? []), ...(gitStatus?.untrackedFiles ?? [])].map((f) => (
                <FileRow
                  key={f}
                  path={f}
                  staged={stagedPaths.has(f)}
                  onStage={() => stageFile(f)}
                  onUnstage={() => unstageFile(f)}
                />
              ))}
            </>
          )}

          {allChanged.length === 0 && (
            <div style={styles.noChanges}>No changes detected.</div>
          )}

          {/* Commit area */}
          <div style={styles.commitArea}>
            <textarea
              style={styles.commitInput}
              placeholder="Commit message…"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              rows={3}
            />
            <button
              style={{
                ...styles.commitBtn,
                ...(stagedPaths.size === 0 || !commitMessage.trim() || isCommitting
                  ? styles.commitBtnDisabled
                  : {}),
              }}
              onClick={handleCommit}
              disabled={stagedPaths.size === 0 || !commitMessage.trim() || isCommitting}
            >
              {isCommitting ? 'Committing…' : `Commit${stagedPaths.size > 0 ? ` (${stagedPaths.size})` : ''}`}
            </button>
          </div>
        </div>
      )}

      {tab === 'log' && (
        <div style={styles.tabContent}>
          {commitLog.length === 0 ? (
            <div style={styles.noChanges}>No commits yet.</div>
          ) : (
            commitLog.map((c) => (
              <div key={c.oid} style={styles.logRow}>
                <span style={styles.logOid}>{c.oid.slice(0, 7)}</span>
                <div style={styles.logMessage}>{c.message.split('\n')[0]}</div>
                <div style={styles.logMeta}>
                  {c.author.name} · {timeAgo(c.author.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div style={styles.tabContent}>
          <div style={styles.settingsForm}>
            <div style={styles.settingsGroup}>
              <label style={styles.settingsLabel}>Remote URL (origin)</label>
              <input
                style={styles.settingsInput}
                type="text"
                placeholder="https://github.com/user/repo.git"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                onBlur={async () => {
                  const url = remoteUrl.trim();
                  if (url === (activeProject?.gitConfig?.remoteUrl ?? '')) return;
                  updateGitConfig({ remoteUrl: url || undefined });
                  if (url) {
                    await platform.gitSetRemote(repoPath, url);
                    pushToast({ message: 'Remote URL updated', severity: 'success' });
                  }
                }}
              />
            </div>

            <div style={styles.settingsDivider} />

            <div style={styles.settingsSectionTitle}>Push / Pull credentials</div>
            <div style={styles.settingsGroup}>
              <label style={styles.settingsLabel}>GitHub username</label>
              <input
                style={styles.settingsInput}
                type="text"
                placeholder="your-github-username"
                value={gitUsername}
                onChange={(e) => setGitUsername(e.target.value)}
                onBlur={async () => {
                  const u = gitUsername.trim();
                  await platform.storeCredential('git-username', u);
                }}
              />
            </div>
            <div style={styles.settingsGroup}>
              <label style={styles.settingsLabel}>Password / token</label>
              <input
                style={styles.settingsInput}
                type="password"
                placeholder="ghp_…"
                value={gitToken}
                onChange={(e) => setGitToken(e.target.value)}
                onBlur={async () => {
                  const t = gitToken.trim();
                  await platform.storeCredential('git-token', t);
                }}
              />
            </div>
            <div style={styles.settingsHint}>
              Stored credentials are used automatically for push and pull.
              Use a GitHub personal access token for best results.
            </div>

            <div style={styles.settingsDivider} />

            <div style={styles.settingsSectionTitle}>Commit author</div>
            <div style={styles.settingsGroup}>
              <label style={styles.settingsLabel}>Name</label>
              <input
                style={styles.settingsInput}
                type="text"
                placeholder="Your Name"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                onBlur={() => {
                  const name = authorName.trim();
                  if (name !== (activeProject?.gitConfig?.userName ?? '')) {
                    updateGitConfig({ userName: name || undefined });
                  }
                }}
              />
            </div>
            <div style={styles.settingsGroup}>
              <label style={styles.settingsLabel}>Email</label>
              <input
                style={styles.settingsInput}
                type="email"
                placeholder="you@example.com"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                onBlur={() => {
                  const email = authorEmail.trim();
                  if (email !== (activeProject?.gitConfig?.userEmail ?? '')) {
                    updateGitConfig({ userEmail: email || undefined });
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Credentials dialog */}
      {credentialPrompt && (
        <div style={styles.credOverlay}>
          <div style={styles.credDialog}>
            <div style={styles.credTitle}>Git Credentials</div>
            <div style={styles.credUrl}>{credentialPrompt.url}</div>
            <input
              style={styles.credInput}
              type="text"
              placeholder="Username"
              value={credUsername}
              onChange={(e) => setCredUsername(e.target.value)}
              autoFocus
            />
            <input
              style={styles.credInput}
              type="password"
              placeholder="Password or token"
              value={credPassword}
              onChange={(e) => setCredPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && credUsername && credPassword) {
                  credentialPrompt.resolve({ username: credUsername, password: credPassword });
                  setCredentialPrompt(null);
                }
              }}
            />
            <div style={styles.credActions}>
              <button
                style={styles.credCancelBtn}
                onClick={() => {
                  credentialPrompt.resolve(null);
                  setCredentialPrompt(null);
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.credSubmitBtn,
                  ...(!credUsername || !credPassword ? styles.commitBtnDisabled : {}),
                }}
                disabled={!credUsername || !credPassword}
                onClick={() => {
                  credentialPrompt.resolve({ username: credUsername, password: credPassword });
                  setCredentialPrompt(null);
                }}
              >
                Authenticate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileRow({
  path,
  staged,
  onStage,
  onUnstage,
}: {
  path: string;
  staged: boolean;
  onStage: () => void;
  onUnstage: () => void;
}) {
  return (
    <div style={styles.fileRow}>
      <input
        type="checkbox"
        checked={staged}
        onChange={(e) => (e.target.checked ? onStage() : onUnstage())}
        style={styles.fileCheckbox}
      />
      <span style={styles.filePath}>{path}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: '#080f1a',
    borderTop: '1px solid #1e293b',
    height: 320,
    flexShrink: 0,
    overflow: 'hidden',
  },
  collapsedBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
    background: '#080f1a',
    borderTop: '1px solid #1e293b',
    cursor: 'pointer',
    flexShrink: 0,
    userSelect: 'none',
  },
  collapsedLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#475569',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aheadBadge: {
    fontSize: 10,
    background: '#1d4ed8',
    borderRadius: 10,
    padding: '0 5px',
    color: '#fff',
    fontFamily: 'monospace',
    fontWeight: 700,
  },
  changeBadge: {
    fontSize: 10,
    background: '#78350f',
    borderRadius: 10,
    padding: '0 5px',
    color: '#fde68a',
    fontFamily: 'monospace',
    fontWeight: 700,
  },
  lastCommitHint: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#334155',
    marginLeft: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 10px',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
    background: '#060d18',
  },
  panelTitle: {
    fontWeight: 700,
    fontSize: 11,
    color: '#60a5fa',
    fontFamily: 'monospace',
  },
  headerAhead: {
    color: '#4ade80',
    fontSize: 10,
  },
  headerBehind: {
    color: '#f87171',
    fontSize: 10,
  },
  headerActions: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
  },
  headerBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  headerBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    fontSize: 12,
    padding: '0 2px',
  },
  errorBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 10px',
    background: '#3f1515',
    borderBottom: '1px solid #7f1d1d',
    fontSize: 11,
    color: '#fca5a5',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  errorDismiss: {
    background: 'transparent',
    border: 'none',
    color: '#fca5a5',
    cursor: 'pointer',
    fontSize: 11,
  },
  tabBar: {
    display: 'flex',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
  },
  tab: {
    background: 'transparent',
    border: 'none',
    borderRight: '1px solid #1e293b',
    color: '#64748b',
    padding: '5px 12px',
    fontSize: 11,
    fontFamily: 'monospace',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  tabActive: {
    background: '#0d1627',
    color: '#93c5fd',
    fontWeight: 700,
  },
  tabBadge: {
    fontSize: 9,
    background: '#334155',
    borderRadius: 10,
    padding: '0 4px',
    color: '#94a3b8',
    fontFamily: 'monospace',
    fontWeight: 700,
  },
  tabContent: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 10px',
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#475569',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    background: '#050c18',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
  },
  sectionBtn: {
    background: 'transparent',
    border: '1px solid #334155',
    color: '#64748b',
    borderRadius: 3,
    padding: '1px 6px',
    fontSize: 9,
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  noChanges: {
    padding: '12px 10px',
    fontSize: 11,
    color: '#475569',
    fontFamily: 'monospace',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  noGit: {
    padding: '16px',
    fontSize: 12,
    color: '#475569',
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 1.6,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  initBtn: {
    background: '#1d4ed8',
    border: '1px solid #2563eb',
    color: '#fff',
    borderRadius: 4,
    padding: '6px 16px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontWeight: 600,
  },
  settingsForm: {
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  settingsGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  settingsLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#64748b',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  settingsInput: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 4,
    color: '#e2e8f0',
    fontSize: 11,
    padding: '5px 8px',
    fontFamily: 'monospace',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  settingsDivider: {
    borderTop: '1px solid #1e293b',
    margin: '4px 0',
  },
  settingsSectionTitle: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#475569',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: -4,
  },
  settingsHint: {
    fontSize: 10,
    color: '#475569',
    fontFamily: 'monospace',
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderBottom: '1px solid #0a1423',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  fileCheckbox: {
    accentColor: '#3b82f6',
    flexShrink: 0,
  },
  filePath: {
    color: '#cbd5e1',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  commitArea: {
    padding: '8px 10px',
    borderTop: '1px solid #1e293b',
    flexShrink: 0,
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  commitInput: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 4,
    color: '#e2e8f0',
    fontSize: 11,
    padding: '5px 8px',
    fontFamily: 'monospace',
    resize: 'none',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  commitBtn: {
    background: '#1d4ed8',
    border: '1px solid #2563eb',
    color: '#fff',
    borderRadius: 4,
    padding: '5px 14px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontWeight: 600,
    alignSelf: 'flex-end',
  },
  commitBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  logRow: {
    padding: '6px 10px',
    borderBottom: '1px solid #0a1423',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  logOid: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#60a5fa',
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  logMessage: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#e2e8f0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logMeta: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#475569',
  },
  credOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  credDialog: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: 16,
    width: 280,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  credTitle: {
    fontWeight: 700,
    fontSize: 13,
    color: '#60a5fa',
    fontFamily: 'monospace',
  },
  credUrl: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  credInput: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 4,
    color: '#e2e8f0',
    fontSize: 12,
    padding: '6px 8px',
    fontFamily: 'monospace',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  credActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 4,
  },
  credCancelBtn: {
    background: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 4,
    padding: '4px 12px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'monospace',
  },
  credSubmitBtn: {
    background: '#1d4ed8',
    border: '1px solid #2563eb',
    color: '#fff',
    borderRadius: 4,
    padding: '4px 12px',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontWeight: 600,
  },
};
