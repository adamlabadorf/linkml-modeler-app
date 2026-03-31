/**
 * Custom edge components for the four LinkML relationship types.
 *
 * | Type      | Visual                        |
 * |-----------|-------------------------------|
 * | range     | Solid line, filled arrowhead  |
 * | is_a      | Solid line, hollow triangle   |
 * | mixin     | Dashed line, hollow triangle  |
 * | union_of  | Dotted line, no arrowhead     |
 */
import { memo } from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';

// ── Shared helpers ────────────────────────────────────────────────────────────

function edgePath(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });
  return { path, labelX, labelY };
}

function EdgeLabel({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label?: string;
}) {
  if (!label) return null;
  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 3,
          padding: '1px 5px',
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#94a3b8',
          pointerEvents: 'all',
          cursor: 'default',
        }}
        className="nodrag nopan"
      >
        {label}
      </div>
    </EdgeLabelRenderer>
  );
}

// ── range edge ─────────────────────────────────────────────────────────────────
// Solid arrow, labeled with slot name.
export const RangeEdge = memo(function RangeEdge(props: EdgeProps) {
  const { path, labelX, labelY } = edgePath(props);
  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={props.markerEnd ?? 'url(#arrow-filled)'}
        style={{ stroke: '#4ade80', strokeWidth: 1.5 }}
      />
      <EdgeLabel x={labelX} y={labelY} label={props.label as string | undefined} />
    </>
  );
});

// ── is_a edge ─────────────────────────────────────────────────────────────────
// Solid line, UML hollow triangle arrowhead.
export const IsAEdge = memo(function IsAEdge(props: EdgeProps) {
  const { path, labelX, labelY } = edgePath(props);
  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={props.markerEnd ?? 'url(#arrow-hollow)'}
        style={{ stroke: '#60a5fa', strokeWidth: 2 }}
      />
      <EdgeLabel x={labelX} y={labelY} label={props.label as string | undefined} />
    </>
  );
});

// ── mixin edge ────────────────────────────────────────────────────────────────
// Dashed line, hollow triangle arrowhead.
export const MixinEdge = memo(function MixinEdge(props: EdgeProps) {
  const { path, labelX, labelY } = edgePath(props);
  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={props.markerEnd ?? 'url(#arrow-hollow)'}
        style={{ stroke: '#c084fc', strokeWidth: 1.5, strokeDasharray: '6 3' }}
      />
      <EdgeLabel x={labelX} y={labelY} label={props.label as string | undefined} />
    </>
  );
});

// ── union_of edge ─────────────────────────────────────────────────────────────
// Dotted line, no arrowhead.
export const UnionOfEdge = memo(function UnionOfEdge(props: EdgeProps) {
  const { path, labelX, labelY } = edgePath(props);
  return (
    <>
      <BaseEdge
        path={path}
        style={{ stroke: '#fb923c', strokeWidth: 1.5, strokeDasharray: '2 4' }}
      />
      <EdgeLabel x={labelX} y={labelY} label={props.label as string | undefined} />
    </>
  );
});

// ── SVG marker defs ───────────────────────────────────────────────────────────
// Drop this component once inside <ReactFlow> (or its parent) via a children
// prop wrapping an <svg> element that ReactFlow renders.

export function EdgeMarkerDefs() {
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
      <defs>
        {/* Filled arrowhead for range edges */}
        <marker
          id="arrow-filled"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#4ade80" />
        </marker>

        {/* Hollow triangle arrowhead for is_a / mixin edges */}
        <marker
          id="arrow-hollow"
          markerWidth="12"
          markerHeight="10"
          refX="10"
          refY="5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 5, 0 10"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="1.5"
          />
        </marker>
      </defs>
    </svg>
  );
}

// ── Edge type map ─────────────────────────────────────────────────────────────
export const edgeTypes = {
  range: RangeEdge,
  is_a: IsAEdge,
  mixin: MixinEdge,
  union_of: UnionOfEdge,
} as const;

export type LinkMLEdgeType = keyof typeof edgeTypes;
