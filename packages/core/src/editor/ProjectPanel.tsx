/**
 * ProjectPanel — tree view of schema files in the active project.
 *
 * Shows each schema file with:
 * - File name (basename of filePath)
 * - Class count / enum count
 * - Dirty indicator (●)
 * - Read-only badge for imported schemas
 * - Click to switch active schema
 */
import React, { useState } from 'react';
import { useAppStore } from '../store/index.js';
import { usePlatform } from '../platform/PlatformContext.js';
import { buildManifestData, writeEditorManifest } from '../io/editorManifest.js';
import { EntitySearchPanel } from './EntitySearchPanel.js';

function basename(filePath: string): string {
  return filePath.split('/').pop() ?? filePath;
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

  const handleToggleVisibility = (e: React.MouseEvent, schemaId: string) => {
    e.stopPropagation();
    const isCurrentlyHidden = hiddenSchemaIds.has(schemaId);
    setSchemaVisible(schemaId, isCurrentlyHidden);
    if (!activeProject) return;
    // Write manifest immediately — visibility change is low-frequency
    const nextHidden = new Set(hiddenSchemaIds);
    if (isCurrentlyHidden) nextHidden.delete(schemaId);
    else nextHidden.add(schemaId);
    const manifest = buildManifestData(activeProject, null, null, nextHidden);
    writeEditorManifest(platform, activeProject.rootPath, manifest);
  };

  if (!activeProject) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.title}>Project</span>
        </div>
        <div style={styles.empty}>No project open</div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      {/* Panel header */}
      <div style={{ ...styles.header, display: 'flex', alignItems: 'center' }}>
        {searchMode ? (
          <>
            <button
              style={styles.searchToggleBtn}
              onClick={() => setSearchMode(false)}
              title="Back to file list"
            >
              ← Files
            </button>
          </>
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

      {/* Search mode: show entity search panel */}
      {searchMode && <EntitySearchPanel />}

      {/* File list mode */}
      {!searchMode && <div style={styles.fileList}>
        {activeProject.schemas.map((sf) => {
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
                ...(sf.isReadOnly ? styles.fileRowReadOnly : {}),
                ...(isHidden ? styles.fileRowHidden : {}),
              }}
              onClick={() => { clearActiveEntity(); if (!sf.isReadOnly) setActiveSchema(sf.id); }}
              title={sf.filePath}
            >
              {/* File icon + name */}
              <div style={styles.fileNameRow}>
                <span style={styles.fileIcon}>{sf.isReadOnly ? '◻' : '◼'}</span>
                <span
                  style={{
                    ...styles.fileName,
                    ...(sf.isReadOnly ? styles.fileNameReadOnly : {}),
                  }}
                >
                  {name}
                </span>
                {sf.isDirty && <span style={styles.dirtyDot} title="Unsaved changes">●</span>}
                {sf.isReadOnly && <span style={styles.readOnlyBadge}>imported</span>}
                <button
                  style={styles.visibilityBtn}
                  onClick={(e) => handleToggleVisibility(e, sf.id)}
                  title={isHidden ? 'Show schema' : 'Hide schema'}
                >
                  {isHidden ? '○' : '●'}
                </button>
              </div>

              {/* Schema name subtitle */}
              {sf.schema.name && (
                <div style={styles.schemaNameRow}>
                  <span style={styles.schemaName} title={sf.schema.id}>
                    {sf.schema.name}
                  </span>
                </div>
              )}

              {/* Stats */}
              <div style={styles.statsRow}>
                <span style={styles.stat} title={`${classCount} class(es)`}>
                  ⬡ {classCount}
                </span>
                <span style={styles.stat} title={`${enumCount} enum(s)`}>
                  ◈ {enumCount}
                </span>
              </div>

              {/* Import paths */}
              {sf.schema.imports.length > 0 && (
                <div style={styles.importsRow}>
                  <span style={styles.importsLabel}>imports:</span>
                  <span style={styles.importsValue}>
                    {sf.schema.imports.slice(0, 3).join(', ')}
                    {sf.schema.imports.length > 3 && ` +${sf.schema.imports.length - 3}`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>}

      {/* Footer: total counts (file mode only) */}
      {!searchMode && (
        <div style={styles.footer}>
          <span style={styles.footerText}>
            {activeProject.schemas.filter((s) => !s.isReadOnly).length} schema(s)
            {activeProject.schemas.some((s) => s.isReadOnly) &&
              ` · ${activeProject.schemas.filter((s) => s.isReadOnly).length} imported`}
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
  },
  title: {
    fontWeight: 700,
    fontSize: 11,
    color: '#60a5fa',
    fontFamily: 'monospace',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  empty: {
    padding: 12,
    fontSize: 12,
    color: '#475569',
    fontFamily: 'monospace',
    fontStyle: 'italic',
  },
  fileList: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  fileRow: {
    padding: '6px 10px',
    cursor: 'pointer',
    borderBottom: '1px solid #0d1627',
    transition: 'background 0.1s',
    userSelect: 'none',
  },
  fileRowActive: {
    background: '#172033',
    borderLeft: '2px solid #60a5fa',
    paddingLeft: 8,
  },
  fileRowReadOnly: {
    opacity: 0.6,
  },
  fileRowHidden: {
    opacity: 0.35,
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
    fontFamily: 'monospace',
    color: '#e2e8f0',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 600,
  },
  fileNameReadOnly: {
    color: '#64748b',
    fontWeight: 400,
    fontStyle: 'italic',
  },
  dirtyDot: {
    color: '#f59e0b',
    fontSize: 10,
    flexShrink: 0,
  },
  readOnlyBadge: {
    fontSize: 9,
    background: '#1e293b',
    borderRadius: 3,
    padding: '1px 4px',
    color: '#64748b',
    flexShrink: 0,
  },
  schemaNameRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 3,
  },
  schemaName: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#7c9cbf',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  stat: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#475569',
  },
  importsRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 3,
  },
  importsLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#334155',
    flexShrink: 0,
  },
  importsValue: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#3b4f6b',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  footer: {
    padding: '6px 10px',
    borderTop: '1px solid #1e293b',
    flexShrink: 0,
  },
  footerText: {
    fontSize: 10,
    color: '#334155',
    fontFamily: 'monospace',
  },
  searchToggleBtn: {
    background: 'transparent',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    fontSize: 11,
    padding: '0 2px',
    fontFamily: 'monospace',
    flexShrink: 0,
  },
};
