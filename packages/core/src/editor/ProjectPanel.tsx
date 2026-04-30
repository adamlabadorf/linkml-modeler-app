/**
 * ProjectPanel — two-section tree view of the active project.
 *
 * Top section:    Local schema files editable in this project.
 * Bottom section: External schemas transitively imported by the project
 *                 (isReadOnly). Clicking them opens them in read-only canvas view.
 */
import React, { useState } from 'react';
import { useAppStore } from '../store/index.js';
import { usePlatform } from '../platform/PlatformContext.js';
import { buildManifestData, writeEditorManifest } from '../io/editorManifest.js';
import { EntitySearchPanel } from './EntitySearchPanel.js';

function basename(filePath: string): string {
  // Handle both / and \ separators, and strip trailing slashes
  return filePath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? filePath;
}

function shortSource(sf: { filePath: string; sourceUrl?: string }): string {
  const src = sf.sourceUrl ?? sf.filePath;
  // Shorten URLs: just show host + last path segment
  try {
    const url = new URL(src);
    const last = url.pathname.split('/').filter(Boolean).pop() ?? '';
    return `${url.hostname}/…/${last}`;
  } catch {
    return basename(src);
  }
}

export function ProjectPanel() {
  const platform = usePlatform();
  const activeProject = useAppStore((s) => s.activeProject);
  const activeSchemaId = useAppStore((s) => s.activeSchemaId);
  const setActiveSchema = useAppStore((s) => s.setActiveSchema);
  const clearActiveEntity = useAppStore((s) => s.clearActiveEntity);
  const hiddenSchemaIds = useAppStore((s) => s.hiddenSchemaIds);
  const setSchemaVisible = useAppStore((s) => s.setSchemaVisible);
  const [searchMode, setSearchMode] = useState(false);
  const [importsCollapsed, setImportsCollapsed] = useState(false);

  const handleToggleVisibility = (e: React.MouseEvent, schemaId: string) => {
    e.stopPropagation();
    const isCurrentlyHidden = hiddenSchemaIds.has(schemaId);
    setSchemaVisible(schemaId, isCurrentlyHidden);
    if (!activeProject) return;
    const nextHidden = new Set(hiddenSchemaIds);
    if (isCurrentlyHidden) nextHidden.delete(schemaId);
    else nextHidden.add(schemaId);
    const manifest = buildManifestData(activeProject, null, null, nextHidden);
    writeEditorManifest(platform, activeProject.rootPath, manifest);
  };

  const handleSelectSchema = (schemaId: string) => {
    clearActiveEntity();
    setActiveSchema(schemaId);
  };

  if (!activeProject) {
    return (
      <div id="lme-project-panel" style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.title}>Project</span>
        </div>
        <div style={styles.empty}>No project open</div>
      </div>
    );
  }

  const localSchemas = activeProject.schemas.filter((s) => !s.isReadOnly);
  const importedSchemas = activeProject.schemas.filter((s) => s.isReadOnly);

  return (
    <div id="lme-project-panel" style={styles.panel}>
      {/* Panel header */}
      <div style={styles.header}>
        {searchMode ? (
          <button style={styles.searchToggleBtn} onClick={() => setSearchMode(false)}>
            ← Files
          </button>
        ) : (
          <>
            <span style={{ ...styles.title, flex: 1 }}>⬡ {activeProject.name}</span>
            <button
              style={styles.searchToggleBtn}
              onClick={() => setSearchMode(true)}
              title="Search entities"
            >
              🔍
            </button>
          </>
        )}
      </div>

      {/* Search mode */}
      {searchMode && <EntitySearchPanel />}

      {/* File list mode */}
      {!searchMode && (
        <>
          {/* ── Local schema files ─────────────────────────────────────────── */}
          <div style={styles.sectionHeader}>
            <span style={styles.sectionLabel}>Project Files</span>
            <span style={styles.sectionCount}>{localSchemas.length}</span>
          </div>

          <div style={styles.fileList}>
            {localSchemas.map((sf) => {
              const isActive = sf.id === activeSchemaId;
              const isHidden = hiddenSchemaIds.has(sf.id);
              const classCount = Object.keys(sf.schema.classes).length;
              const enumCount = Object.keys(sf.schema.enums).length;
              const name = basename(sf.filePath);

              return (
                <div
                  key={sf.id}
                  style={{
                    ...styles.fileRow,
                    ...(isActive ? styles.fileRowActive : {}),
                    ...(isHidden ? styles.fileRowHidden : {}),
                  }}
                  onClick={() => handleSelectSchema(sf.id)}
                  title={sf.filePath}
                >
                  <div style={styles.fileNameRow}>
                    <span style={styles.fileIcon}>◼</span>
                    <span style={styles.fileName}>{name}</span>
                    {sf.isDirty && (
                      <span style={styles.dirtyDot} title="Unsaved changes">●</span>
                    )}
                    <button
                      style={styles.visibilityBtn}
                      onClick={(e) => handleToggleVisibility(e, sf.id)}
                      title={isHidden ? 'Show schema' : 'Hide schema'}
                    >
                      {isHidden ? '○' : '●'}
                    </button>
                  </div>
                  {sf.schema.name && (
                    <div style={styles.schemaNameRow}>
                      <span style={styles.schemaName} title={sf.schema.id}>
                        {sf.schema.name}
                      </span>
                    </div>
                  )}
                  <div style={styles.statsRow}>
                    <span style={styles.stat} title={`${classCount} class(es)`}>⬡ {classCount}</span>
                    <span style={styles.stat} title={`${enumCount} enum(s)`}>◈ {enumCount}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Imported schemas ──────────────────────────────────────────── */}
          {importedSchemas.length > 0 && (
            <>
              <div
                style={styles.importsSectionHeader}
                onClick={() => setImportsCollapsed((c) => !c)}
                title={importsCollapsed ? 'Expand imports' : 'Collapse imports'}
              >
                <span style={styles.chevron}>{importsCollapsed ? '▶' : '▼'}</span>
                <span style={styles.sectionLabel}>Imports</span>
                <span style={styles.sectionCount}>{importedSchemas.length}</span>
              </div>

              {!importsCollapsed && (
                <div style={styles.importsList}>
                  {importedSchemas.map((sf) => {
                    const isActive = sf.id === activeSchemaId;
                    const classCount = Object.keys(sf.schema.classes).length;
                    const enumCount = Object.keys(sf.schema.enums).length;
                    const displayName = sf.schema.name || basename(sf.filePath);
                    const source = shortSource(sf);

                    return (
                      <div
                        key={sf.id}
                        style={{
                          ...styles.fileRow,
                          ...styles.importRow,
                          ...(isActive ? styles.importRowActive : {}),
                        }}
                        onClick={() => handleSelectSchema(sf.id)}
                        title={sf.sourceUrl ?? sf.filePath}
                      >
                        <div style={styles.fileNameRow}>
                          <span style={styles.fileIcon}>◻</span>
                          <span style={styles.importName}>{displayName}</span>
                          <span style={styles.readOnlyBadge}>ro</span>
                        </div>
                        <div style={styles.importSourceRow}>
                          <span style={styles.importSource}>{source}</span>
                        </div>
                        <div style={styles.statsRow}>
                          <span style={styles.stat} title={`${classCount} class(es)`}>⬡ {classCount}</span>
                          <span style={styles.stat} title={`${enumCount} enum(s)`}>◈ {enumCount}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Footer */}
      {!searchMode && (
        <div style={styles.footer}>
          <span style={styles.footerText}>
            {localSchemas.length} file{localSchemas.length !== 1 ? 's' : ''}
            {importedSchemas.length > 0 && ` · ${importedSchemas.length} imported`}
          </span>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    width: 220,
    borderRight: '1px solid #1e293b',
    background: '#080f1a',
    flexShrink: 0,
    overflow: 'hidden',
  },
  header: {
    padding: '8px 10px',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    fontWeight: 700,
    fontSize: 11,
    color: '#60a5fa',
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
    flex: 1,
  },
  empty: {
    padding: 12,
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderBottom: '1px solid #0d1627',
    flexShrink: 0,
  },
  importsSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderTop: '1px solid #1e293b',
    borderBottom: '1px solid #0d1627',
    flexShrink: 0,
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  chevron: {
    fontSize: 8,
    color: '#475569',
    flexShrink: 0,
  },
  sectionLabel: {
    fontSize: 9,
    color: '#475569',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    flex: 1,
  },
  sectionCount: {
    fontSize: 9,
    color: '#334155',
    background: '#0d1627',
    borderRadius: 8,
    padding: '0 5px',
  },
  fileList: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '4px 0',
    minHeight: 0,
  },
  importsList: {
    overflowY: 'auto' as const,
    padding: '4px 0',
    maxHeight: 220,
    borderBottom: '1px solid #1e293b',
  },
  fileRow: {
    padding: '6px 10px',
    cursor: 'pointer',
    borderBottom: '1px solid #0d1627',
    userSelect: 'none' as const,
  },
  fileRowActive: {
    background: '#172033',
    borderLeft: '2px solid #60a5fa',
    paddingLeft: 8,
  },
  fileRowHidden: {
    opacity: 0.35,
  },
  importRow: {
    opacity: 0.85,
  },
  importRowActive: {
    background: '#141f2e',
    borderLeft: '2px solid #7c9cbf',
    paddingLeft: 8,
  },
  visibilityBtn: {
    background: 'transparent',
    border: 'none',
    color: '#334155',
    cursor: 'pointer',
    padding: '0 2px',
    fontSize: 8,
    lineHeight: 1,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  fileNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  fileIcon: {
    fontSize: 10,
    color: '#475569',
    flexShrink: 0,
  },
  fileName: {
    fontSize: 12,
    fontFamily: 'var(--font-family-mono)',
    color: '#e2e8f0',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    fontWeight: 600,
  },
  importName: {
    fontSize: 12,
    fontFamily: 'var(--font-family-mono)',
    color: '#94a3b8',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    fontWeight: 500,
    fontStyle: 'italic' as const,
  },
  importSourceRow: {
    marginBottom: 3,
  },
  importSource: {
    fontSize: 9,
    fontFamily: 'var(--font-family-mono)',
    color: '#334155',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    display: 'block',
  },
  dirtyDot: {
    color: '#f59e0b',
    fontSize: 10,
    flexShrink: 0,
  },
  readOnlyBadge: {
    fontSize: 8,
    background: '#1a2535',
    borderRadius: 3,
    padding: '1px 4px',
    color: '#475569',
    flexShrink: 0,
    letterSpacing: 0.5,
  },
  schemaNameRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 3,
  },
  schemaName: {
    fontSize: 10,
    fontFamily: 'var(--font-family-mono)',
    color: '#7c9cbf',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  stat: {
    fontSize: 10,
    color: '#475569',
  },
  footer: {
    padding: '6px 10px',
    borderTop: '1px solid #1e293b',
    flexShrink: 0,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 10,
    color: '#334155',
  },
  searchToggleBtn: {
    background: 'transparent',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    fontSize: 11,
    padding: '0 2px',
    flexShrink: 0,
  },
};
