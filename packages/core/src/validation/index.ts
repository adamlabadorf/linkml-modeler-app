/**
 * M6 Validation Engine — inline and schema-level validation for LinkML schemas.
 *
 * Rules:
 *  - Class names: PascalCase (CamelCase)
 *  - Slot/attribute names: snake_case
 *  - Existence: referenced is_a, mixins, ranges must resolve
 *  - Circularity: no inheritance cycles
 *  - Metadata completeness: id, name; description recommended
 */
import type { LinkMLSchema, ClassDefinition } from '../model/index.js';

// ── Issue types ───────────────────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  /** Human-readable message */
  message: string;
  /** Dot-path to the offending entity, e.g. "classes.Person.attributes.full_name" */
  path: string;
  /** Category for grouping */
  category: 'naming' | 'existence' | 'circularity' | 'metadata' | 'schema';
  /** If set, clicking "jump" navigates to this entity */
  jump?: JumpTarget;
}

export type JumpTarget =
  | { type: 'class'; className: string }
  | { type: 'enum'; enumName: string }
  | { type: 'schema' };

// ── Naming convention helpers ─────────────────────────────────────────────────

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;

function isPascalCase(s: string): boolean {
  return PASCAL_CASE.test(s);
}

function isSnakeCase(s: string): boolean {
  return SNAKE_CASE.test(s);
}

// ── Built-in types that are always valid ranges ───────────────────────────────

const BUILTIN_TYPES = new Set([
  'string', 'integer', 'float', 'double', 'boolean',
  'date', 'datetime', 'time', 'uri', 'uriorcurie', 'curie',
  'ncname', 'objectidentifier', 'nodeidentifier', 'jsonpointer',
  'jsonpath', 'sparqlpath', 'Any',
]);

// ── Main validator ────────────────────────────────────────────────────────────

let _issueCounter = 0;
function nextId() {
  return `vi-${++_issueCounter}`;
}

/** Names from schemas imported into the active schema (used to avoid false-positive existence errors). */
export interface ExternalNames {
  classes: Set<string>;
  enums: Set<string>;
}

export function validateSchemaFull(
  schema: LinkMLSchema,
  externalNames: ExternalNames = { classes: new Set(), enums: new Set() }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // ── Schema-level metadata ────────────────────────────────────────────────
  if (!schema.id) {
    issues.push({
      id: nextId(), severity: 'error', category: 'schema',
      path: 'id',
      message: 'Schema must have an id (URI)',
      jump: { type: 'schema' },
    });
  }
  if (!schema.name) {
    issues.push({
      id: nextId(), severity: 'error', category: 'schema',
      path: 'name',
      message: 'Schema must have a name',
      jump: { type: 'schema' },
    });
  }
  if (!schema.defaultPrefix) {
    issues.push({
      id: nextId(), severity: 'warning', category: 'metadata',
      path: 'default_prefix',
      message: 'Schema should have a default_prefix',
      jump: { type: 'schema' },
    });
  }
  if (!schema.description) {
    issues.push({
      id: nextId(), severity: 'info', category: 'metadata',
      path: 'description',
      message: 'Schema description is missing',
      jump: { type: 'schema' },
    });
  }

  const allClassNames = new Set(Object.keys(schema.classes));
  const allEnumNames = new Set(Object.keys(schema.enums));
  const allTypeNames = new Set(Object.keys(schema.types));

  function isValidRange(range: string): boolean {
    return (
      BUILTIN_TYPES.has(range) ||
      allClassNames.has(range) ||
      allEnumNames.has(range) ||
      allTypeNames.has(range) ||
      externalNames.classes.has(range) ||
      externalNames.enums.has(range)
    );
  }

  // ── Class validation ─────────────────────────────────────────────────────
  for (const [className, cls] of Object.entries(schema.classes)) {
    // Naming
    if (!isPascalCase(className)) {
      issues.push({
        id: nextId(), severity: 'warning', category: 'naming',
        path: `classes.${className}`,
        message: `Class name '${className}' should be PascalCase`,
        jump: { type: 'class', className },
      });
    }

    // Metadata completeness
    if (!cls.description) {
      issues.push({
        id: nextId(), severity: 'info', category: 'metadata',
        path: `classes.${className}.description`,
        message: `Class '${className}' has no description`,
        jump: { type: 'class', className },
      });
    }

    // is_a existence
    if (cls.isA && !allClassNames.has(cls.isA) && !externalNames.classes.has(cls.isA)) {
      issues.push({
        id: nextId(), severity: 'error', category: 'existence',
        path: `classes.${className}.is_a`,
        message: `Class '${className}' is_a '${cls.isA}' which does not exist`,
        jump: { type: 'class', className },
      });
    }

    // mixin existence
    for (const mixin of cls.mixins) {
      if (!allClassNames.has(mixin) && !externalNames.classes.has(mixin)) {
        issues.push({
          id: nextId(), severity: 'error', category: 'existence',
          path: `classes.${className}.mixins`,
          message: `Class '${className}' references mixin '${mixin}' which does not exist`,
          jump: { type: 'class', className },
        });
      }
    }

    // Attribute validation
    for (const [slotName, slot] of Object.entries(cls.attributes)) {
      // Naming
      if (!isSnakeCase(slotName)) {
        issues.push({
          id: nextId(), severity: 'warning', category: 'naming',
          path: `classes.${className}.attributes.${slotName}`,
          message: `Attribute '${slotName}' on '${className}' should be snake_case`,
          jump: { type: 'class', className },
        });
      }

      // Range existence
      if (slot.range && !isValidRange(slot.range)) {
        issues.push({
          id: nextId(), severity: 'error', category: 'existence',
          path: `classes.${className}.attributes.${slotName}.range`,
          message: `Attribute '${slotName}' range '${slot.range}' does not exist`,
          jump: { type: 'class', className },
        });
      }
    }
  }

  // ── Circularity detection ─────────────────────────────────────────────────
  const cycles = detectInheritanceCycles(schema.classes);
  for (const cycle of cycles) {
    const className = cycle[0];
    issues.push({
      id: nextId(), severity: 'error', category: 'circularity',
      path: `classes.${className}.is_a`,
      message: `Inheritance cycle detected: ${cycle.join(' → ')}`,
      jump: { type: 'class', className },
    });
  }

  // ── Enum validation ─────────────────────────────────────────────────────
  for (const [enumName, enm] of Object.entries(schema.enums)) {
    // Naming — enums conventionally PascalCase
    if (!isPascalCase(enumName)) {
      issues.push({
        id: nextId(), severity: 'warning', category: 'naming',
        path: `enums.${enumName}`,
        message: `Enum name '${enumName}' should be PascalCase`,
        jump: { type: 'enum', enumName },
      });
    }

    if (!enm.description) {
      issues.push({
        id: nextId(), severity: 'info', category: 'metadata',
        path: `enums.${enumName}.description`,
        message: `Enum '${enumName}' has no description`,
        jump: { type: 'enum', enumName },
      });
    }

    if (Object.keys(enm.permissibleValues).length === 0) {
      issues.push({
        id: nextId(), severity: 'warning', category: 'metadata',
        path: `enums.${enumName}.permissible_values`,
        message: `Enum '${enumName}' has no permissible values`,
        jump: { type: 'enum', enumName },
      });
    }
  }

  return issues;
}

/**
 * Detect inheritance cycles in the class graph.
 * Returns an array of cycle paths (each path is the chain of class names).
 */
function detectInheritanceCycles(
  classes: Record<string, ClassDefinition>
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(name: string, path: string[]): void {
    if (inStack.has(name)) {
      // Found cycle — find where it starts
      const idx = path.indexOf(name);
      cycles.push([...path.slice(idx), name]);
      return;
    }
    if (visited.has(name)) return;

    visited.add(name);
    inStack.add(name);
    path.push(name);

    const cls = classes[name];
    if (cls?.isA && cls.isA in classes) {
      dfs(cls.isA, path);
    }

    path.pop();
    inStack.delete(name);
  }

  for (const name of Object.keys(classes)) {
    dfs(name, []);
  }

  return cycles;
}

/**
 * Quick inline check for a single class (used for real-time highlights).
 * Returns issues for just that class.
 */
export function validateClass(
  className: string,
  schema: LinkMLSchema
): ValidationIssue[] {
  const all = validateSchemaFull(schema);
  return all.filter(
    (i) =>
      i.path.startsWith(`classes.${className}`) ||
      (i.category === 'circularity' && i.path.includes(className))
  );
}

/**
 * Quick inline check for a single enum.
 */
export function validateEnum(
  enumName: string,
  schema: LinkMLSchema
): ValidationIssue[] {
  const all = validateSchemaFull(schema);
  return all.filter((i) => i.path.startsWith(`enums.${enumName}`));
}
