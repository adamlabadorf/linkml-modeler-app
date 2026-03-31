import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { CanvasNodeData } from '../store/slices/canvasSlice.js';
import type { EnumDefinition } from '../model/index.js';

export interface EnumNodeData extends CanvasNodeData {
  entityType: 'enum';
  enumDef: EnumDefinition;
  collapsed: boolean;
}

const VALUE_LIMIT = 12;

function EnumNode({ data, selected }: NodeProps<EnumNodeData>) {
  const { enumDef, collapsed } = data;
  const values = Object.values(enumDef.permissibleValues);
  const visibleValues = collapsed ? [] : values.slice(0, VALUE_LIMIT);
  const hiddenCount = collapsed ? 0 : Math.max(0, values.length - VALUE_LIMIT);

  return (
    <div
      style={{
        ...styles.wrapper,
        outline: selected ? '2px solid #60a5fa' : '1px solid #334155',
      }}
    >
      {/* Enum nodes only receive edges (range targets) */}
      <Handle type="target" position={Position.Top} style={styles.handle} />

      {/* Header */}
      <div style={styles.header}>
        <span style={styles.nodeIcon}>◈</span>
        <span style={styles.headerTitle}>{enumDef.name}</span>
      </div>

      {/* Values */}
      {!collapsed && (
        <div style={styles.body}>
          {visibleValues.map((v) => (
            <div key={v.text} style={styles.valueRow}>
              <span style={styles.valueText}>{v.text}</span>
              {v.meaning && (
                <span style={styles.valueMeaning} title={v.meaning}>
                  → {v.meaning}
                </span>
              )}
            </div>
          ))}
          {hiddenCount > 0 && (
            <div style={styles.moreRow}>+{hiddenCount} more…</div>
          )}
          {visibleValues.length === 0 && values.length === 0 && (
            <div style={styles.emptyRow}>no values</div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={styles.handle} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: '#1e293b',
    borderRadius: 6,
    minWidth: 180,
    maxWidth: 280,
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#e2e8f0',
    overflow: 'hidden',
  },
  handle: {
    background: '#60a5fa',
    width: 8,
    height: 8,
    border: '2px solid #1e293b',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    background: '#b45309',
    color: '#fff',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  nodeIcon: {
    fontSize: 14,
    opacity: 0.8,
  },
  headerTitle: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  body: {
    padding: '4px 0',
  },
  valueRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '2px 10px',
    borderBottom: '1px solid #1e293b',
    minHeight: 22,
    gap: 4,
  },
  valueText: {
    color: '#fde68a',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  valueMeaning: {
    color: '#64748b',
    fontSize: 10,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 100,
  },
  moreRow: {
    padding: '3px 10px',
    color: '#64748b',
    fontStyle: 'italic',
    fontSize: 11,
  },
  emptyRow: {
    padding: '4px 10px',
    color: '#475569',
    fontStyle: 'italic',
  },
};

export default memo(EnumNode);
