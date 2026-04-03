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
import type { ImportGroupNodeData } from './ImportGroupNode.js';
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

// Import group layout constants
const GROUP_PADDING = 16;
const GROUP_HEADER = 36;
const GROUP_INNER_COLS = 3;
const GROUP_INNER_H_GAP = 260;
const GROUP_INNER_V_GAP = 140;

function gridPosition(index: number): { x: number; y: number } {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return { x: col * GRID_H_GAP, y: row * GRID_V_GAP };
}

/** Compute a grid position for a child within a group container. */
function groupChildPosition(index: number): { x: number; y: number } {
  const col = index % GROUP_INNER_COLS;
  const row = Math.floor(index / GROUP_INNER_COLS);
  return {
    x: GROUP_PADDING + col * GROUP_INNER_H_GAP,
    y: GROUP_HEADER + GROUP_PADDING + row * GROUP_INNER_V_GAP,
  };
}

/** Extract a human-friendly label from a file path. */
function labelFromPath(filePath: string): string {
  const parts = filePath.split('/');
  const file = parts[parts.length - 1];
  return file.replace(/\.ya?ml$/, '');
}

export interface DerivedGraph {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
}

export function deriveGraph(
  schema: LinkMLSchema,
  layout: CanvasLayout,
  collapsed: Record<string, boolean> = {},
  ghostEntities: ImportedEntity[] = [],
  collapsedGroups: Record<string, boolean> = {}
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

  // ── Ghost nodes (imported entities grouped by source schema) ───────────────
  const existingIds = new Set(nodes.map((n) => n.id));

  // Group ghost entities by source file path
  const ghostGroups = new Map<string, ImportedEntity[]>();
  for (const entity of ghostEntities) {
    if (existingIds.has(entity.name)) continue; // local definition takes priority
    const ghostId = `ghost__${entity.name}`;
    if (existingIds.has(ghostId)) continue;

    const group = ghostGroups.get(entity.sourceFilePath) ?? [];
    group.push(entity);
    ghostGroups.set(entity.sourceFilePath, group);
  }

  // Track all ghost IDs for edge creation
  const allGhostIds = new Set<string>();

  for (const [sourceFile, entities] of ghostGroups) {
    const groupId = `importGroup__${sourceFile}`;
    const isGroupCollapsed = collapsedGroups[groupId] ?? false;

    // Compute child positions (absolute) — we always compute these so the group
    // node knows its bounds even when collapsed.
    const groupPos = layout.nodes[groupId] ?? gridPosition(gridIndex++);
    const childPositions: Array<{
      ghostId: string;
      entity: ImportedEntity;
      absX: number;
      absY: number;
      w: number;
      h: number;
    }> = [];

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const ghostId = `ghost__${entity.name}`;
      const w = entity.type === 'class' ? CLASS_NODE_WIDTH : ENUM_NODE_WIDTH;
      const h = entity.type === 'class' ? CLASS_NODE_HEIGHT : ENUM_NODE_HEIGHT;

      // Check if the ghost has a saved layout position (absolute)
      const savedPos = layout.nodes[ghostId];
      let absX: number;
      let absY: number;

      if (savedPos) {
        absX = savedPos.x;
        absY = savedPos.y;
      } else {
        // Place inside the group using internal grid
        const inner = groupChildPosition(i);
        absX = groupPos.x + inner.x;
        absY = groupPos.y + inner.y;
      }

      childPositions.push({ ghostId, entity, absX, absY, w, h });
    }

    // Compute group bounds from children
    const minX = Math.min(...childPositions.map((c) => c.absX));
    const minY = Math.min(...childPositions.map((c) => c.absY));
    const maxX = Math.max(...childPositions.map((c) => c.absX + c.w));
    const maxY = Math.max(...childPositions.map((c) => c.absY + c.h));

    const groupX = minX - GROUP_PADDING;
    const groupY = minY - GROUP_HEADER - GROUP_PADDING;
    const groupWidth = maxX - minX + 2 * GROUP_PADDING;
    const expandedHeight = maxY - minY + GROUP_HEADER + 2 * GROUP_PADDING;
    const collapsedHeight = GROUP_HEADER + GROUP_PADDING;

    // Create group background node (inserted at beginning for lower z-index)
    const groupData: ImportGroupNodeData = {
      entityId: groupId,
      entityType: 'importGroup',
      label: labelFromPath(sourceFile),
      sourceFilePath: sourceFile,
      collapsed: isGroupCollapsed,
      childCount: entities.length,
    };

    nodes.unshift({
      id: groupId,
      type: 'importGroupNode',
      position: { x: groupX, y: groupY },
      data: groupData as unknown as CanvasNodeData,
      style: {
        width: groupWidth,
        height: isGroupCollapsed ? collapsedHeight : expandedHeight,
      },
      zIndex: -1,
      draggable: false,
      selectable: false,
    });

    // Only add child nodes and their edges when the group is expanded
    if (!isGroupCollapsed) {
      for (const child of childPositions) {
        existingIds.add(child.ghostId);
        allGhostIds.add(child.ghostId);

        if (child.entity.type === 'class') {
          const nodeData: ClassNodeData = {
            entityId: child.entity.name,
            entityType: 'class',
            classDef: child.entity.schema.classes[child.entity.name],
            collapsed: false,
            ghost: true,
          };
          nodes.push({
            id: child.ghostId,
            type: 'classNode',
            position: { x: child.absX, y: child.absY },
            data: nodeData as unknown as CanvasNodeData,
            width: CLASS_NODE_WIDTH,
            height: CLASS_NODE_HEIGHT,
            draggable: false,
          });
        } else {
          const nodeData: EnumNodeData = {
            entityId: child.entity.name,
            entityType: 'enum',
            enumDef: child.entity.schema.enums[child.entity.name],
            collapsed: false,
            ghost: true,
          };
          nodes.push({
            id: child.ghostId,
            type: 'enumNode',
            position: { x: child.absX, y: child.absY },
            data: nodeData as unknown as CanvasNodeData,
            width: ENUM_NODE_WIDTH,
            height: ENUM_NODE_HEIGHT,
            draggable: false,
          });
        }
      }
    }
  }

  // ── Range / is_a / mixin edges to ghost nodes ──────────────────────────────
  for (const [className, classDef] of Object.entries(schema.classes)) {
    // Range edges
    for (const [slotName, slot] of Object.entries(classDef.attributes)) {
      if (!slot.range) continue;
      const ghostId = `ghost__${slot.range}`;
      if (
        allGhostIds.has(ghostId) &&
        !edges.find((e) => e.id === `range__${className}__${slotName}__${slot.range}`)
      ) {
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

    // is_a edge to ghost
    if (classDef.isA) {
      const ghostId = `ghost__${classDef.isA}`;
      if (allGhostIds.has(ghostId)) {
        edges.push({
          id: `isa__${className}__${classDef.isA}`,
          type: 'is_a' as LinkMLEdgeType,
          source: className,
          target: ghostId,
          animated: false,
        });
      }
    }

    // mixin edges to ghost
    for (const mixinName of classDef.mixins) {
      const ghostId = `ghost__${mixinName}`;
      if (allGhostIds.has(ghostId)) {
        edges.push({
          id: `mixin__${className}__${mixinName}`,
          type: 'mixin' as LinkMLEdgeType,
          source: className,
          target: ghostId,
          animated: false,
        });
      }
    }

    // union_of edges to ghost
    if (classDef.unionOf) {
      for (const memberName of classDef.unionOf) {
        const ghostId = `ghost__${memberName}`;
        if (allGhostIds.has(ghostId)) {
          edges.push({
            id: `union__${className}__${memberName}`,
            type: 'union_of' as LinkMLEdgeType,
            source: className,
            target: ghostId,
            animated: false,
          });
        }
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
