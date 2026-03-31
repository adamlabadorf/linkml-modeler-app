/**
 * FocusModeToolbar — M6 focus mode controls.
 *
 * Provides:
 *  1. Subset-based focus: dropdown of available subsets → dim non-member classes
 *  2. Selection-based focus: "Focus Selection" button → isolate selected nodes + neighbors
 *
 * Placed as an overlay inside SchemaCanvas (or as a standalone toolbar strip).
 */
import React, { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/index.js';

export function FocusModeToolbar() {
  const activeSchemaFile = useAppStore((s) => s.getActiveSchema());
  const focusMode = useAppStore((s) => s.focusMode);
  const setFocusMode = useAppStore((s) => s.setFocusMode);
  const selectedNodeIds = useAppStore((s) => s.selectedNodeIds);
  const edges = useAppStore((s) => s.edges);

  // Collect subsets from the active schema
  const subsets = useMemo(() => {
    if (!activeSchemaFile) return [];
    return Object.keys(activeSchemaFile.schema.subsets);
  }, [activeSchemaFile]);

  // Enter subset focus
  const handleSubsetFocus = useCallback(
    (subsetName: string) => {
      if (!subsetName) {
        setFocusMode(null);
        return;
      }
      setFocusMode({ type: 'subset', subsetName });
    },
    [setFocusMode]
  );

  // Enter selection focus — includes selected nodes + their direct neighbors
  const handleSelectionFocus = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const neighborIds = new Set(selectedNodeIds);
    for (const edge of edges) {
      if (selectedNodeIds.includes(edge.source)) neighborIds.add(edge.target);
      if (selectedNodeIds.includes(edge.target)) neighborIds.add(edge.source);
    }
    setFocusMode({ type: 'selection', nodeIds: Array.from(neighborIds) });
  }, [selectedNodeIds, edges, setFocusMode]);

  const handleExit = useCallback(() => setFocusMode(null), [setFocusMode]);

  if (!activeSchemaFile) return null;

  const activeSubset =
    focusMode?.type === 'subset' ? focusMode.subsetName : '';

  return (
    <div style={styles.toolbar}>
      {/* Subset focus */}
      {subsets.length > 0 && (
        <div style={styles.group}>
          <span style={styles.groupLabel}>Subset:</span>
          <select
            style={styles.subsetSelect}
            value={activeSubset}
            onChange={(e) => handleSubsetFocus(e.target.value)}
            title="Enter subset focus mode"
          >
            <option value="">(none)</option>
            {subsets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Selection focus */}
      <button
        style={{
          ...styles.focusBtn,
          ...(selectedNodeIds.length === 0 ? styles.focusBtnDisabled : {}),
          ...(focusMode?.type === 'selection' ? styles.focusBtnActive : {}),
        }}
        onClick={handleSelectionFocus}
        disabled={selectedNodeIds.length === 0}
        title={
          selectedNodeIds.length === 0
            ? 'Select nodes on the canvas first (rubber-band or click)'
            : `Focus ${selectedNodeIds.length} selected node(s) + neighbors`
        }
      >
        ⬡ Focus Selection
        {selectedNodeIds.length > 0 && (
          <span style={styles.selCount}>{selectedNodeIds.length}</span>
        )}
      </button>

      {/* Exit focus */}
      {focusMode && (
        <button style={styles.exitBtn} onClick={handleExit} title="Exit focus mode">
          ✕ Exit Focus
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    background: '#0c1a2e',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  group: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  groupLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    whiteSpace: 'nowrap',
  },
  subsetSelect: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 4,
    color: '#e2e8f0',
    fontSize: 11,
    padding: '2px 6px',
    fontFamily: 'monospace',
    cursor: 'pointer',
    outline: 'none',
  },
  focusBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 11,
    fontFamily: 'monospace',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  focusBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  focusBtnActive: {
    background: '#1e3a5f',
    border: '1px solid #2563eb',
    color: '#93c5fd',
  },
  selCount: {
    background: '#334155',
    borderRadius: 10,
    padding: '0 5px',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 700,
    color: '#cbd5e1',
  },
  exitBtn: {
    background: 'transparent',
    border: '1px solid #3b82f6',
    color: '#60a5fa',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 11,
    fontFamily: 'monospace',
    cursor: 'pointer',
  },
};
