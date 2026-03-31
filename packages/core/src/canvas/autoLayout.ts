/**
 * Auto-layout engine using elkjs (Eclipse Layout Kernel).
 *
 * Produces a CanvasLayout by running the ELK `layered` (Sugiyama-style)
 * algorithm over the schema's class/enum graph.
 *
 * Usage:
 *   const layout = await runAutoLayout(schema);
 *   store.setNodes(deriveGraph(schema, layout).nodes);
 */
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk-api.js';
import type { LinkMLSchema, CanvasLayout } from '../model/index.js';

// Node dimensions used for layout calculations
const CLASS_W = 240;
const CLASS_H = 120;
const ENUM_W = 200;
const ENUM_H = 80;

const elk = new ELK();

export interface AutoLayoutOptions {
  /** ELK algorithm — defaults to layered (Sugiyama) */
  algorithm?: string;
  /** Direction: TB | BT | LR | RL */
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  /** Spacing between nodes */
  nodeNodeSpacing?: number;
  /** Spacing between hierarchy levels */
  layerSpacing?: number;
}

const DEFAULT_OPTIONS: Required<AutoLayoutOptions> = {
  algorithm: 'layered',
  direction: 'TB',
  nodeNodeSpacing: 40,
  layerSpacing: 80,
};

export async function runAutoLayout(
  schema: LinkMLSchema,
  opts: AutoLayoutOptions = {}
): Promise<CanvasLayout> {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  const elkNodes: ElkNode[] = [];
  const elkEdges: ElkExtendedEdge[] = [];
  const edgeSeen = new Set<string>();

  // ── Add class nodes ────────────────────────────────────────────────────────
  for (const className of Object.keys(schema.classes)) {
    elkNodes.push({
      id: className,
      width: CLASS_W,
      height: CLASS_H,
    });
  }

  // ── Add enum nodes ─────────────────────────────────────────────────────────
  for (const enumName of Object.keys(schema.enums)) {
    elkNodes.push({
      id: enumName,
      width: ENUM_W,
      height: ENUM_H,
    });
  }

  const allIds = new Set([
    ...Object.keys(schema.classes),
    ...Object.keys(schema.enums),
  ]);

  // ── Add edges from class relationships ────────────────────────────────────
  for (const [className, classDef] of Object.entries(schema.classes)) {
    // is_a
    if (classDef.isA && allIds.has(classDef.isA)) {
      addEdge(elkEdges, edgeSeen, `isa__${className}__${classDef.isA}`, className, classDef.isA);
    }

    // mixins
    for (const m of classDef.mixins) {
      if (allIds.has(m)) {
        addEdge(elkEdges, edgeSeen, `mixin__${className}__${m}`, className, m);
      }
    }

    // union_of
    if (classDef.unionOf) {
      for (const u of classDef.unionOf) {
        if (allIds.has(u)) {
          addEdge(elkEdges, edgeSeen, `union__${className}__${u}`, className, u);
        }
      }
    }

    // range edges (only to known classes/enums)
    for (const [slotName, slot] of Object.entries(classDef.attributes)) {
      if (slot.range && allIds.has(slot.range)) {
        addEdge(
          elkEdges,
          edgeSeen,
          `range__${className}__${slotName}__${slot.range}`,
          className,
          slot.range
        );
      }
    }
  }

  // ── Build ELK graph ────────────────────────────────────────────────────────
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': options.algorithm,
      'elk.direction': options.direction,
      'elk.spacing.nodeNode': String(options.nodeNodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(options.layerSpacing),
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: elkNodes,
    edges: elkEdges,
  };

  try {
    const result = await elk.layout(elkGraph);
    return elkResultToLayout(result);
  } catch (err) {
    // Fallback: return empty layout so grid positions are used
    console.warn('[AutoLayout] ELK layout failed, falling back to grid:', err);
    return { nodes: {}, viewport: { x: 0, y: 0, zoom: 1 } };
  }
}

function addEdge(
  edges: ElkExtendedEdge[],
  seen: Set<string>,
  id: string,
  source: string,
  target: string
) {
  if (seen.has(id)) return;
  seen.add(id);
  edges.push({ id, sources: [source], targets: [target] });
}

function elkResultToLayout(elkNode: ElkNode): CanvasLayout {
  const layout: CanvasLayout = {
    nodes: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  for (const child of elkNode.children ?? []) {
    if (child.x !== undefined && child.y !== undefined) {
      layout.nodes[child.id] = { x: child.x, y: child.y };
    }
  }
  return layout;
}

/**
 * Merge a computed layout with user-adjusted positions stored in a sidecar.
 * User positions take precedence over auto-layout positions.
 */
export function mergeLayouts(
  autoLayout: CanvasLayout,
  sidecar: CanvasLayout
): CanvasLayout {
  return {
    nodes: { ...autoLayout.nodes, ...sidecar.nodes },
    viewport: sidecar.viewport ?? autoLayout.viewport,
  };
}
