// ProjectSwitcherDialog — lists all registered projects and allows switching.

import React from 'react';
import { useAppStore, openProjectFromDirectory } from '@linkml-editor/core';
import { usePlatform } from '@linkml-editor/core';
import { WebProjectRegistry, type ProjectRegistryEntry } from '../platform/ProjectRegistry.js';

const registry = new WebProjectRegistry();

interface ProjectSwitcherDialogProps {
  onClose: () => void;
}

export function ProjectSwitcherDialog({ onClose }: ProjectSwitcherDialogProps) {
  const platform = usePlatform();
  const activeProject = useAppStore((s) => s.activeProject);
  const closeProject = useAppStore((s) => s.closeProject);
  const setProject = useAppStore((s) => s.setProject);
  const pushToast = useAppStore((s) => s.pushToast);

  const [projects, setProjects] = React.useState<ProjectRegistryEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [removingUrl, setRemovingUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    setProjects(registry.getAll().sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt)));
  }, []);

  const handleSelect = async (entry: ProjectRegistryEntry) => {
    if (activeProject?.rootPath === entry.localPath) {
      onClose();
      return;
    }

    // Warn if current project has unsaved changes
    const wasDirty = closeProject();
    if (wasDirty) {
      pushToast({ message: 'Unsaved changes were discarded when switching projects', severity: 'warning' });
    }

    setLoading(true);
    try {
      const project = await openProjectFromDirectory(entry.localPath, platform);
      if (project.schemas.length === 0) {
        pushToast({ message: `No LinkML schemas found in "${entry.repoName}"`, severity: 'warning' });
        setLoading(false);
        return;
      }
      project.name = entry.repoName;
      // Restore git config if this was a git-backed project
      if (entry.repoUrl) {
        project.gitConfig = {
          enabled: true,
          remoteUrl: entry.repoUrl,
          defaultBranch: 'main',
        };
      }
      setProject(project);
      onClose();
    } catch (err) {
      pushToast({
        message: `Failed to open "${entry.repoName}": ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
      setLoading(false);
    }
  };

  const handleRemoveRequest = (e: React.MouseEvent, repoUrl: string) => {
    e.stopPropagation();
    setRemovingUrl(repoUrl);
  };

  const handleRemoveConfirm = () => {
    if (!removingUrl) return;
    registry.remove(removingUrl);
    setProjects(registry.getAll().sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt)));
    setRemovingUrl(null);
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div style={s.overlay} onClick={handleOverlayClick}>
      <div style={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.title}>Switch Project</h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {loading ? (
          <div style={s.loading}>Opening project…</div>
        ) : projects.length === 0 ? (
          <div style={s.empty}>No registered projects found.</div>
        ) : (
          <div style={s.list}>
            {projects.map((entry) => {
              const isCurrent = activeProject?.rootPath === entry.localPath;
              return (
                <div
                  key={entry.repoUrl || entry.localPath}
                  style={{
                    ...s.item,
                    ...(isCurrent ? s.itemCurrent : {}),
                  }}
                  onClick={() => !isCurrent && handleSelect(entry)}
                  onMouseEnter={(e) => {
                    if (!isCurrent) {
                      (e.currentTarget as HTMLDivElement).style.background = '#1e293b';
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#334155';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) {
                      (e.currentTarget as HTMLDivElement).style.background = '#0c1a2e';
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#1e293b';
                    }
                  }}
                >
                  <div style={s.itemInfo}>
                    <div style={s.itemName}>
                      {entry.repoName}
                      {isCurrent && <span style={s.currentBadge}>current</span>}
                    </div>
                    {entry.repoUrl && (
                      <div style={s.itemUrl}>{entry.repoUrl}</div>
                    )}
                    <div style={s.itemPath}>{entry.localPath}</div>
                  </div>
                  <div style={s.itemMeta}>
                    <span style={s.itemDate}>{formatDate(entry.lastOpenedAt)}</span>
                    {!isCurrent && (
                      <button
                        style={s.removeBtn}
                        onClick={(e) => handleRemoveRequest(e, entry.repoUrl || entry.localPath)}
                        title="Remove from registry"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Remove confirmation */}
        {removingUrl && (
          <div style={s.confirmBar}>
            <span style={s.confirmText}>Remove this project from the registry?</span>
            <button style={s.confirmBtn} onClick={handleRemoveConfirm}>Remove</button>
            <button style={s.cancelBtn} onClick={() => setRemovingUrl(null)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
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
    width: '90%',
    maxWidth: 560,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'monospace',
    color: '#e2e8f0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #334155',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: '#60a5fa',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 6px',
    borderRadius: 3,
    lineHeight: 1,
  },
  loading: {
    padding: 32,
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 13,
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 13,
  },
  list: {
    overflowY: 'auto',
    flex: 1,
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: '#0c1a2e',
    border: '1px solid #1e293b',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    gap: 12,
  },
  itemCurrent: {
    background: '#0f2544',
    border: '1px solid #1e4080',
    cursor: 'default',
  },
  itemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  currentBadge: {
    fontSize: 10,
    color: '#60a5fa',
    background: '#1e3a5f',
    border: '1px solid #1e4080',
    borderRadius: 3,
    padding: '1px 5px',
    fontWeight: 500,
  },
  itemUrl: {
    fontSize: 10,
    color: '#60a5fa',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemPath: {
    fontSize: 10,
    color: '#475569',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  itemDate: {
    fontSize: 10,
    color: '#475569',
    whiteSpace: 'nowrap',
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    padding: '2px 4px',
    fontSize: 12,
    lineHeight: 1,
    borderRadius: 3,
  },
  confirmBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 20px',
    borderTop: '1px solid #334155',
    background: '#1e293b',
    flexShrink: 0,
  },
  confirmText: {
    fontSize: 12,
    color: '#fde68a',
    flex: 1,
  },
  confirmBtn: {
    background: '#7f1d1d',
    border: '1px solid #991b1b',
    color: '#fca5a5',
    borderRadius: 4,
    padding: '4px 12px',
    fontSize: 12,
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
  cancelBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 4,
    padding: '4px 12px',
    fontSize: 12,
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
};
