import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { CanvasNodeData } from '../store/slices/canvasSlice.js';
import type { ClassDefinition, SlotDefinition } from '../model/index.js';
import { ArrowUp, Hexagon, Plus } from '../ui/icons/index.js';

export interface ResolvedSlot {
  slot: SlotDefinition;
  kind: 'attribute' | 'schema'; // A = inline attribute, S = schema-level slot reference
  hasUsageOverride?: boolean;   // true when slot_usage overrides exist for this slot
  inherited?: boolean;          // true when slot comes from is_a / mixin ancestor
  inheritedFrom?: string;       // name of the immediate ancestor that contributes this slot
}

export interface ClassNodeData extends CanvasNodeData {
  entityType: 'class';
  classDef: ClassDefinition;
  collapsed: boolean;
  ghost?: boolean; // True for read-only imported classes
  resolvedSlots?: ResolvedSlot[]; // Pre-merged, alphabetically sorted for display
}

const SLOT_LIMIT_EXPANDED = 20;

function SlotRow({ resolved }: { resolved: ResolvedSlot }) {
  const { slot, kind, hasUsageOverride, inherited, inheritedFrom } = resolved;
  const badges: string[] = [];
  if (slot.required) badges.push('R');
  if (slot.multivalued) badges.push('M');
  if (slot.identifier) badges.push('id');

  const kindBadgeStyle: React.CSSProperties = {
    ...styles.badge,
    background: inherited
      ? '#1a2435'
      : kind === 'schema' ? '#1e3a5f' : '#1e293b',
    color: inherited
      ? '#4a6080'
      : kind === 'schema' ? '#7dd3fc' : '#94a3b8',
  };

  const rowStyle = inherited
    ? { ...styles.slotRow, opacity: 0.55 }
    : styles.slotRow;

  return (
    <div style={rowStyle} title={inherited && inheritedFrom ? `Inherited from ${inheritedFrom}` : undefined}>
      <span style={styles.slotPlus}><Plus size={10} /></span>
      <span style={inherited ? styles.slotNameInherited : styles.slotName}>{slot.name}</span>
      {slot.range && (
        <>
          <span style={styles.slotColon}> : </span>
          <span style={inherited ? styles.slotRangeInherited : styles.slotRange}>{slot.range}</span>
        </>
      )}
      <span style={styles.badgeGroup}>
        {inherited && (
          <span style={{ ...styles.badge, background: '#1a2435', color: '#4a6080' }} title={inheritedFrom ? `from ${inheritedFrom}` : 'inherited'}><ArrowUp size={10} /></span>
        )}
        <span style={kindBadgeStyle}>{kind === 'schema' ? 'S' : 'A'}</span>
        {hasUsageOverride && <span style={{ ...styles.badge, color: '#fbbf24' }}>~</span>}
        {badges.map((b) => (
          <span key={b} style={styles.badge}>{b}</span>
        ))}
      </span>
    </div>
  );
}

function ClassNode({ data, selected }: NodeProps<ClassNodeData>) {
  const { classDef, collapsed, ghost, resolvedSlots: resolvedSlotsProp } = data;

  const isAbstract = classDef.abstract === true;
  const isMixin = classDef.mixin === true;

  const headerBg = ghost
    ? '#1e3a2e'
    : isMixin
    ? '#7c3aed'
    : isAbstract
    ? '#0369a1'
    : '#1d4ed8';

  const typeLabel = ghost ? 'imported' : isMixin ? 'mixin' : isAbstract ? 'abstract' : null;

  // Fall back to plain attributes if resolvedSlots not provided (e.g. ghost nodes)
  const resolvedSlots: ResolvedSlot[] = resolvedSlotsProp ??
    Object.values(classDef.attributes).map((s) => ({ slot: s, kind: 'attribute' as const }));
  const visibleSlots = collapsed ? [] : resolvedSlots.slice(0, SLOT_LIMIT_EXPANDED);
  const hiddenCount = collapsed ? 0 : Math.max(0, resolvedSlots.length - SLOT_LIMIT_EXPANDED);

  return (
    <div
      style={{
        ...styles.wrapper,
        ...(ghost ? styles.ghostWrapper : {}),
        outline: selected ? '2px solid #60a5fa' : ghost ? '1px dashed #374f3a' : '1px solid #334155',
      }}
    >
      {/* Target handle (top) — for edges pointing into this node */}
      <Handle
        type="target"
        position={Position.Top}
        style={styles.handle}
      />

      {/* Header */}
      <div style={{ ...styles.header, background: headerBg }}>
        <span style={styles.nodeIcon}><Hexagon size={14} /></span>
        <span style={isAbstract ? { ...styles.headerTitle, fontStyle: 'italic' } : styles.headerTitle}>
          {classDef.name}
        </span>
        {typeLabel && <span style={styles.typeBadge}>[{typeLabel}]</span>}
      </div>

      {/* is_a */}
      {classDef.isA && !collapsed && (
        <div style={styles.isaRow}>
          <span style={styles.isaLabel}>is_a: </span>
          <span style={styles.isaValue}>{classDef.isA}</span>
        </div>
      )}

      {/* Slots */}
      {!collapsed && (
        <div style={styles.body}>
          {visibleSlots.map((r) => (
            <SlotRow key={r.slot.name} resolved={r} />
          ))}
          {hiddenCount > 0 && (
            <div style={styles.moreRow}>+{hiddenCount} more…</div>
          )}
          {visibleSlots.length === 0 && resolvedSlots.length === 0 && (
            <div style={styles.emptyRow}>no slots</div>
          )}
        </div>
      )}

      {/* Source handle (bottom) — for outgoing range/mixin edges */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={styles.handle}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: '#1e293b',
    borderRadius: 6,
    minWidth: 200,
    maxWidth: 320,
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#e2e8f0',
    overflow: 'hidden',
  },
  ghostWrapper: {
    background: '#111c14',
    opacity: 0.72,
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
    color: '#fff',
    fontWeight: 600,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  nodeIcon: {
    opacity: 0.8,
    display: 'flex',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  typeBadge: {
    fontSize: 10,
    background: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    padding: '1px 4px',
    flexShrink: 0,
  },
  isaRow: {
    padding: '3px 10px',
    borderBottom: '1px solid #334155',
    fontSize: 11,
    color: '#94a3b8',
    background: '#253047',
  },
  isaLabel: {
    color: '#64748b',
  },
  isaValue: {
    color: '#93c5fd',
  },
  body: {
    padding: '4px 0',
  },
  slotRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '2px 10px',
    gap: 2,
    borderBottom: '1px solid #1e293b',
    minHeight: 22,
  },
  slotPlus: {
    color: '#64748b',
    marginRight: 2,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  slotName: {
    color: '#e2e8f0',
    flex: '0 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  slotNameInherited: {
    color: '#64748b',
    flex: '0 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  slotColon: {
    color: '#64748b',
    flexShrink: 0,
  },
  slotRange: {
    color: '#86efac',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  slotRangeInherited: {
    color: '#3d6b4a',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badgeGroup: {
    display: 'flex',
    gap: 2,
    flexShrink: 0,
    marginLeft: 4,
  },
  badge: {
    fontSize: 9,
    background: '#334155',
    borderRadius: 3,
    padding: '0 3px',
    color: '#94a3b8',
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

export default memo(ClassNode);
