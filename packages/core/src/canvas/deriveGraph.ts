/**
 * Derives ReactFlow nodes and edges from a LinkMLSchema + CanvasLayout.
 *
 * This is a pure function — no Zustand access here. Call it from a selector
 * or useMemo hook whenever the schema or layout changes.
 */
import type { Node, Edge } from 'reactflow';
import type { LinkMLSchema, CanvasLayout } from '../model/index.js';
import type { CanvasNodeData } from '../store/slices/canvasSlice.js';
import type { ClassNodeData } from './ClassNode.js';
import type { EnumNodeData } from './EnumNode.js';
import type { LinkMLEdgeType } from './edges.js';
import type { ImportedEntity } from '../io/importResolver.js';

// Default node dimensions used before layout runs.
const CLASS_NODE_WIDTH = 240;
const CLASS_NODE_HEIGHT = 120;
const ENUM_NODE_WIDTH = 200;
const ENUM_NODE_HEIGHT = 80;

// Grid fallback positions for nodes that have no layout entry yet.
const GRID_COLS = 5;
const GRID_H_GAP = 280;
const GRID_V_GAP = 160;

function gridPosition(index: number): { x: number; y: number } {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return { x: col * GRID_H_GAP, y: row * GRID_V_GAP };
}

export interface DerivedGraph {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
}

export function deriveGraph(
  schema: LinkMLSchema,
  layout: CanvasLayout,
  collapsed: Record<string, boolean> = {},
  ghostEntities: ImportedEntity[] = []
): DerivedGraph {
  const nodes: Node<CanvasNodeData>[] = [];
  const edges: Edge[] = [];
  let gridIndex = 0;

  // ── Class nodes ─────────────────────────────────────────────────────────────
  for (const [className, classDef] of Object.entries(schema.classes)) {
    const pos = layout.nodes[className] ?? gridPosition(gridIndex++);
    const isCollapsed = collapsed[className] ?? false;

    const nodeData: ClassNodeData = {
      entityId: className,
      entityType: 'class',
      classDef,
      collapsed: isCollapsed,
    };

    nodes.push({
      id: className,
      type: 'classNode',
      position: { x: pos.x, y: pos.y },
      data: nodeData as unknown as CanvasNodeData,
      width: CLASS_NODE_WIDTH,
      height: CLASS_NODE_HEIGHT,
    });

    // ── is_a edge ──────────────────────────────────────────────────────────
    if (classDef.isA && schema.classes[classDef.isA]) {
      edges.push({
        id: `isa__${className}__${classDef.isA}`,
        type: 'is_a' as LinkMLEdgeType,
        source: className,
        target: classDef.isA,
        animated: false,
      });
    }

    // ── mixin edges ────────────────────────────────────────────────────────
    for (const mixinName of classDef.mixins) {
      if (schema.classes[mixinName]) {
        edges.push({
          id: `mixin__${className}__${mixinName}`,
          type: 'mixin' as LinkMLEdgeType,
          source: className,
          target: mixinName,
          animated: false,
        });
      }
    }

    // ── union_of edges ─────────────────────────────────────────────────────
    if (classDef.unionOf) {
      for (const memberName of classDef.unionOf) {
        if (schema.classes[memberName]) {
          edges.push({
            id: `union__${className}__${memberName}`,
            type: 'union_of' as LinkMLEdgeType,
            source: className,
            target: memberName,
            animated: false,
          });
        }
      }
    }

    // ── range edges (from attributes) ─────────────────────────────────────
    for (const [slotName, slot] of Object.entries(classDef.attributes)) {
      if (!slot.range) continue;
      const rangeIsClass = slot.range in schema.classes;
      const rangeIsEnum = slot.range in schema.enums;
      if (rangeIsClass || rangeIsEnum) {
        edges.push({
          id: `range__${className}__${slotName}__${slot.range}`,
          type: 'range' as LinkMLEdgeType,
          source: className,
          target: slot.range,
          label: slotName,
          data: {
            slotName,
            range: slot.range,
            required: slot.required ?? false,
            multivalued: slot.multivalued ?? false,
            identifier: slot.identifier ?? false,
          },
          animated: false,
        });
      }
    }
  }

  // ── Enum nodes ──────────────────────────────────────────────────────────────
  for (const [enumName, enumDef] of Object.entries(schema.enums)) {
    const pos = layout.nodes[enumName] ?? gridPosition(gridIndex++);
    const isCollapsed = collapsed[enumName] ?? false;

    const nodeData: EnumNodeData = {
      entityId: enumName,
      entityType: 'enum',
      enumDef,
      collapsed: isCollapsed,
    };

    nodes.push({
      id: enumName,
      type: 'enumNode',
      position: { x: pos.x, y: pos.y },
      data: nodeData as unknown as CanvasNodeData,
      width: ENUM_NODE_WIDTH,
      height: ENUM_NODE_HEIGHT,
    });
  }

  // ── Ghost nodes (imported read-only entities) ────────────────────────────────
  // Track existing node IDs to avoid duplicates with local entities
  const existingIds = new Set(nodes.map((n) => n.id));

  for (const entity of ghostEntities) {
    if (existingIds.has(entity.name)) continue; // local definition takes priority

    const ghostId = `ghost__${entity.name}`;
    if (existingIds.has(ghostId)) continue;
    existingIds.add(ghostId);

    const pos = layout.nodes[`ghost__${entity.name}`] ?? gridPosition(gridIndex++);

    if (entity.type === 'class') {
      const nodeData: ClassNodeData = {
        entityId: entity.name,
        entityType: 'class',
        classDef: entity.schema.classes[entity.name],
        collapsed: false,
        ghost: true,
      };
      nodes.push({
        id: ghostId,
        type: 'classNode',
        position: { x: pos.x, y: pos.y },
        data: nodeData as unknown as CanvasNodeData,
        width: CLASS_NODE_WIDTH,
        height: CLASS_NODE_HEIGHT,
        draggable: false,
      });
    } else {
      const nodeData: EnumNodeData = {
        entityId: entity.name,
        entityType: 'enum',
        enumDef: entity.schema.enums[entity.name],
        collapsed: false,
        ghost: true,
      };
      nodes.push({
        id: ghostId,
        type: 'enumNode',
        position: { x: pos.x, y: pos.y },
        data: nodeData as unknown as CanvasNodeData,
        width: ENUM_NODE_WIDTH,
        height: ENUM_NODE_HEIGHT,
        draggable: false,
      });
    }
  }

  // ── Range edges to ghost nodes ───────────────────────────────────────────────
  // Add range edges from local classes to ghost targets
  for (const [className, classDef] of Object.entries(schema.classes)) {
    for (const [slotName, slot] of Object.entries(classDef.attributes)) {
      if (!slot.range) continue;
      // Check if range targets a ghost node
      const ghostId = `ghost__${slot.range}`;
      if (existingIds.has(ghostId) && !edges.find((e) => e.id === `range__${className}__${slotName}__${slot.range}`)) {
        edges.push({
          id: `range__${className}__${slotName}__${slot.range}`,
          type: 'range' as LinkMLEdgeType,
          source: className,
          target: ghostId,
          label: slotName,
          data: {
            slotName,
            range: slot.range,
            required: slot.required ?? false,
            multivalued: slot.multivalued ?? false,
            identifier: slot.identifier ?? false,
          },
          animated: false,
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Returns a set of entity names (class + enum) present in the schema.
 * Used to validate layout sidecar references.
 */
export function schemaEntityNames(schema: LinkMLSchema): Set<string> {
  return new Set([...Object.keys(schema.classes), ...Object.keys(schema.enums)]);
}
