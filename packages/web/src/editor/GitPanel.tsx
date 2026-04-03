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

type Tab = 'changes' | 'log';

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
  const setLastGitError = useAppStore((s) => s.setLastGitError);
  const pushToast = useAppStore((s) => s.pushToast);

  const [tab, setTab] = useState<Tab>('changes');
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
      const oid = await platform.gitCommit(repoPath, commitMessage);
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

  const handlePush = useCallback(async () => {
    if (!gitAvailable) return;
    setIsPushing(true);
    setLastGitError(null);
    try {
      const result = await platform.gitPush(repoPath);
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
  }, [gitAvailable, repoPath, platform, setIsPushing, setLastGitError, pushToast, refreshStatus]);

  if (!gitPanelOpen) {
    return (
      <div style={styles.collapsedBar} onClick={() => setGitPanelOpen(true)}>
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
    return (
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <span style={styles.panelTitle}>⎇ Git</span>
          <button style={styles.closeBtn} onClick={() => setGitPanelOpen(false)}>✕</button>
        </div>
        <div style={styles.noGit}>
          Git not available for this project.
          <br />
          Open a project directory with a .git folder.
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
    <div style={styles.panel}>
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
    height: 280,
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
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 1.6,
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
};
