// Splash / Welcome page — shown when no project is loaded.

import React from 'react';
import { useAppStore } from '../store/index.js';
import { usePlatform } from '../platform/PlatformContext.js';
import { getRecentProjects, removeRecentProject } from '../project/recentProjects.js';
import { openProjectFromDirectory, createNewProject } from '../project/projectLoader.js';
import type { RecentProject } from '../model/index.js';

export function SplashPage() {
  const platform = usePlatform();
  const setProject = useAppStore((s) => s.setProject);
  const pushToast = useAppStore((s) => s.pushToast);
  const setCloneDialogOpen = useAppStore((s) => s.setCloneDialogOpen);

  const [recentProjects, setRecentProjects] = React.useState<RecentProject[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    setRecentProjects(getRecentProjects());
  }, []);

  const handleNewProject = () => {
    const project = createNewProject('Untitled Schema');
    setProject(project);
  };

  const handleOpenFolder = async () => {
    const dirPath = await platform.openDirectory();
    if (!dirPath) return;

    setIsLoading(true);
    try {
      const project = await openProjectFromDirectory(dirPath, platform);
      if (project.schemas.length === 0) {
        pushToast({ message: 'No LinkML schemas found in this directory', severity: 'warning' });
        setIsLoading(false);
        return;
      }
      setProject(project);
    } catch (err) {
      pushToast({
        message: `Failed to open project: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
    }
    setIsLoading(false);
  };

  const handleOpenRecent = async (recent: RecentProject) => {
    setIsLoading(true);
    try {
      const project = await openProjectFromDirectory(recent.rootPath, platform);
      if (project.schemas.length === 0) {
        pushToast({ message: 'No LinkML schemas found — the directory may have changed', severity: 'warning' });
        setIsLoading(false);
        return;
      }
      // Preserve the project name from the recent entry
      project.name = recent.name;
      setProject(project);
    } catch (err) {
      pushToast({
        message: `Failed to open project: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
      setIsLoading(false);
    }
  };

  const handleRemoveRecent = (e: React.MouseEvent, rootPath: string) => {
    e.stopPropagation();
    removeRecentProject(rootPath);
    setRecentProjects(getRecentProjects());
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

  if (isLoading) {
    return (
      <div style={s.root}>
        <div style={s.loadingContainer}>
          <span style={s.loadingText}>Opening project...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.container}>
        {/* Logo + branding */}
        <div style={s.branding}>
          <div style={s.logoIcon}>⬡</div>
          <h1 style={s.title}>LinkML Visual Schema Editor</h1>
          <span style={s.version}>v0.1.3</span>
        </div>

        {/* Action buttons */}
        <div style={s.actions}>
          <button style={s.actionBtn} onClick={handleNewProject}>
            <span style={s.actionIcon}>+</span>
            <span style={s.actionLabel}>New Empty Project</span>
            <span style={s.actionHint}>Start with a blank schema</span>
          </button>

          <button style={s.actionBtn} onClick={handleOpenFolder}>
            <span style={s.actionIcon}>📂</span>
            <span style={s.actionLabel}>Open Local Folder</span>
            <span style={s.actionHint}>Scan directory for LinkML schemas</span>
          </button>

          <button style={s.actionBtn} onClick={() => setCloneDialogOpen(true)}>
            <span style={s.actionIcon}>🔗</span>
            <span style={s.actionLabel}>Clone from URL</span>
            <span style={s.actionHint}>Clone a git repository</span>
          </button>
        </div>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div style={s.recentSection}>
            <h2 style={s.recentTitle}>Recent Projects</h2>
            <div style={s.recentList}>
              {recentProjects.map((rp) => (
                <div
                  key={rp.rootPath}
                  style={s.recentItem}
                  onClick={() => handleOpenRecent(rp)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = '#1e293b';
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#334155';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = '#0c1a2e';
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#1e293b';
                  }}
                >
                  <div style={s.recentInfo}>
                    <span style={s.recentName}>{rp.name}</span>
                    <span style={s.recentPath}>{rp.rootPath}</span>
                  </div>
                  <div style={s.recentMeta}>
                    <span style={s.recentSource}>{rp.source === 'git' ? '⎇ git' : '📁 local'}</span>
                    <span style={s.recentDate}>{formatDate(rp.lastOpened)}</span>
                    <button
                      style={s.removeBtn}
                      onClick={(e) => handleRemoveRecent(e, rp.rootPath)}
                      title="Remove from recent"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer hint */}
        <div style={s.hint}>
          Tip: Open a directory with <code style={s.code}>.yaml</code> files containing LinkML schemas
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    background: '#0f172a',
    fontFamily: 'monospace',
    color: '#e2e8f0',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 32,
    maxWidth: 560,
    width: '100%',
    padding: '40px 24px',
  },
  branding: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    fontSize: 48,
    color: '#60a5fa',
    lineHeight: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#e2e8f0',
    margin: 0,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  version: {
    fontSize: 11,
    color: '#475569',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    background: '#0c1a2e',
    border: '1px solid #1e293b',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'monospace',
    color: '#e2e8f0',
    textAlign: 'left' as const,
    transition: 'background 0.15s, border-color 0.15s',
  },
  actionIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: 600,
    flex: 1,
  },
  actionHint: {
    fontSize: 11,
    color: '#64748b',
    flexShrink: 0,
  },
  recentSection: {
    width: '100%',
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    margin: '0 0 10px 0',
    fontFamily: 'monospace',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 260,
    overflowY: 'auto',
  },
  recentItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#0c1a2e',
    border: '1px solid #1e293b',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
  },
  recentInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    flex: 1,
  },
  recentName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#e2e8f0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  recentPath: {
    fontSize: 10,
    color: '#475569',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  recentMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    marginLeft: 12,
  },
  recentSource: {
    fontSize: 10,
    color: '#64748b',
  },
  recentDate: {
    fontSize: 10,
    color: '#475569',
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
  hint: {
    fontSize: 11,
    color: '#334155',
    textAlign: 'center',
  },
  code: {
    background: '#1e293b',
    padding: '1px 5px',
    borderRadius: 3,
    fontSize: 11,
    color: '#94a3b8',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
  },
};
