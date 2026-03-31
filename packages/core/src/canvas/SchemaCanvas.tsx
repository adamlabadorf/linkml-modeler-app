/**
 * SchemaCanvas — main ReactFlow canvas component for LinkML schema visualization.
 *
 * Responsibilities:
 * - Render ClassNode and EnumNode custom node types
 * - Render four custom edge types (range, is_a, mixin, union_of)
 * - Derive nodes/edges from the active schema in the Zustand store
 * - Trigger auto-layout on first load (no sidecar) or on demand
 * - Persist node drag positions back to the store (canvasLayout)
 * - Expose layout button in a control overlay
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  NodeTypes,
  OnNodesChange,
  OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import ClassNode from './ClassNode.js';
import EnumNode from './EnumNode.js';
import { edgeTypes, EdgeMarkerDefs } from './edges.js';
import { deriveGraph } from './deriveGraph.js';
import { runAutoLayout } from './autoLayout.js';
import { useAppStore } from '../store/index.js';
import type { CanvasLayout } from '../model/index.js';

// ── Node type registry ────────────────────────────────────────────────────────
const nodeTypes: NodeTypes = {
  classNode: ClassNode,
  enumNode: EnumNode,
};

// ── Inner component (needs ReactFlowProvider context) ─────────────────────────
function SchemaCanvasInner() {
  const { fitView } = useReactFlow();

  // Zustand store
  const activeProject = useAppStore((s) => s.activeProject);
  const activeSchemaId = useAppStore((s) => s.activeSchemaId);
  const setNodes = useAppStore((s) => s.setNodes);
  const setEdges = useAppStore((s) => s.setEdges);
  const updateNodePosition = useAppStore((s) => s.updateNodePosition);
  const setViewport = useAppStore((s) => s.setViewport);
  const toggleNodeCollapsed = useAppStore((s) => s.toggleNodeCollapsed);
  const storeNodes = useAppStore((s) => s.nodes);
  const storeEdges = useAppStore((s) => s.edges);
  const viewport = useAppStore((s) => s.viewport);
  const focusMode = useAppStore((s) => s.focusMode);

  // Local layout state for deferred initialization
  const [localLayout, setLocalLayout] = useState<CanvasLayout>({
    nodes: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  });
  const layoutRanRef = useRef(false);

  // Active schema
  const activeSchemaFile = useMemo(
    () => activeProject?.schemas.find((s) => s.id === activeSchemaId),
    [activeProject, activeSchemaId]
  );

  // Derive graph whenever schema or layout changes
  const { nodes: derivedNodes, edges: derivedEdges } = useMemo(() => {
    if (!activeSchemaFile) return { nodes: [], edges: [] };
    return deriveGraph(activeSchemaFile.schema, localLayout);
  }, [activeSchemaFile, localLayout]);

  // Sync derived nodes/edges into store
  useEffect(() => {
    setNodes(derivedNodes);
    setEdges(derivedEdges);
  }, [derivedNodes, derivedEdges, setNodes, setEdges]);

  // Auto-layout on first load when no positions are stored
  useEffect(() => {
    if (!activeSchemaFile || layoutRanRef.current) return;
    const hasLayoutData = Object.keys(activeSchemaFile.canvasLayout.nodes).length > 0;
    if (hasLayoutData) {
      setLocalLayout(activeSchemaFile.canvasLayout);
      layoutRanRef.current = true;
      return;
    }
    layoutRanRef.current = true;
    runAutoLayout(activeSchemaFile.schema).then((layout) => {
      setLocalLayout(layout);
      setTimeout(() => fitView({ padding: 0.1, duration: 400 }), 100);
    });
  }, [activeSchemaFile, fitView]);

  // Reset layout flag when schema changes
  useEffect(() => {
    layoutRanRef.current = false;
  }, [activeSchemaId]);

  // Manual re-layout handler
  const handleAutoLayout = useCallback(async () => {
    if (!activeSchemaFile) return;
    const layout = await runAutoLayout(activeSchemaFile.schema);
    setLocalLayout(layout);
    setTimeout(() => fitView({ padding: 0.1, duration: 400 }), 100);
  }, [activeSchemaFile, fitView]);

  // ── ReactFlow event handlers ────────────────────────────────────────────────
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes(applyNodeChanges(changes, storeNodes) as typeof storeNodes);
      // Persist position changes back to layout
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          setLocalLayout((prev) => ({
            ...prev,
            nodes: {
              ...prev.nodes,
              [change.id]: { x: change.position!.x, y: change.position!.y },
            },
          }));
          updateNodePosition(change.id, change.position.x, change.position.y);
        }
      }
    },
    [storeNodes, setNodes, updateNodePosition]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges(applyEdgeChanges(changes, storeEdges)),
    [storeEdges, setEdges]
  );

  const onMoveEnd = useCallback(
    (_event: unknown, vp: { x: number; y: number; zoom: number }) => setViewport(vp),
    [setViewport]
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      toggleNodeCollapsed(node.id);
    },
    [toggleNodeCollapsed]
  );

  // ── Focus mode dimming ──────────────────────────────────────────────────────
  const visibleNodeIds = useMemo<Set<string> | null>(() => {
    if (!focusMode) return null;
    if (focusMode.type === 'selection') return new Set(focusMode.nodeIds);
    // Subset mode — filter by subset membership
    if (focusMode.type === 'subset' && activeSchemaFile) {
      const ids = new Set<string>();
      for (const [name, cls] of Object.entries(activeSchemaFile.schema.classes)) {
        if (cls.subsetOf?.includes(focusMode.subsetName)) ids.add(name);
      }
      return ids;
    }
    return null;
  }, [focusMode, activeSchemaFile]);

  // Apply dim styling to nodes outside focus
  const displayNodes: Node[] = useMemo(() => {
    if (!visibleNodeIds) return storeNodes;
    return storeNodes.map((n) => ({
      ...n,
      style: visibleNodeIds.has(n.id)
        ? n.style
        : { ...n.style, opacity: 0.3, pointerEvents: 'none' as const },
    }));
  }, [storeNodes, visibleNodeIds]);

  // Empty state
  if (!activeSchemaFile) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyInner}>
          <p style={styles.emptyTitle}>No schema open</p>
          <p style={styles.emptyHint}>Open a project to see the canvas</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.canvasWrapper}>
      <EdgeMarkerDefs />
      <ReactFlow
        nodes={displayNodes}
        edges={storeEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onMoveEnd={onMoveEnd}
        onNodeDoubleClick={onNodeDoubleClick}
        defaultViewport={viewport}
        minZoom={0.05}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            if ((n.data as { entityType: string }).entityType === 'enum') return '#b45309';
            const d = n.data as { classDef?: { abstract?: boolean; mixin?: boolean } };
            if (d.classDef?.mixin) return '#7c3aed';
            if (d.classDef?.abstract) return '#0369a1';
            return '#1d4ed8';
          }}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: '#0f172a' }}
        />
      </ReactFlow>

      {/* Auto-layout button */}
      <button style={styles.layoutBtn} onClick={handleAutoLayout} title="Auto Layout (Ctrl+Shift+L)">
        ⬡ Auto Layout
      </button>

      {/* Focus mode banner */}
      {focusMode && (
        <div style={styles.focusBanner}>
          <span>
            Focus mode:{' '}
            {focusMode.type === 'subset'
              ? `subset "${focusMode.subsetName}"`
              : `${(focusMode as { nodeIds: string[] }).nodeIds.length} node(s) selected`}
          </span>
          <button
            style={styles.focusExitBtn}
            onClick={() => useAppStore.getState().setFocusMode(null)}
          >
            Exit focus
          </button>
        </div>
      )}
    </div>
  );
}

// ── Public component (wraps provider) ─────────────────────────────────────────
export function SchemaCanvas() {
  return (
    <ReactFlowProvider>
      <SchemaCanvasInner />
    </ReactFlowProvider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  canvasWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: '#0f172a',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: '#0f172a',
  },
  emptyInner: {
    textAlign: 'center',
    color: '#475569',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 600,
    margin: '0 0 8px',
    color: '#64748b',
  },
  emptyHint: {
    fontSize: 14,
    margin: 0,
  },
  layoutBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    background: '#1e293b',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12,
    fontFamily: 'monospace',
    cursor: 'pointer',
    zIndex: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  focusBanner: {
    position: 'absolute',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#1e3a5f',
    border: '1px solid #2563eb',
    borderRadius: 6,
    padding: '6px 14px',
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#93c5fd',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  focusExitBtn: {
    background: 'transparent',
    border: '1px solid #3b82f6',
    color: '#60a5fa',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    cursor: 'pointer',
  },
};
