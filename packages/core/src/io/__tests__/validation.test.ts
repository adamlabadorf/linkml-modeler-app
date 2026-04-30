/**
 * Table-driven validation rule tests (PTS-80 §AC-T08).
 *
 * Design-spec §9.1 informally refers to ValidationIssue fields as:
 *   "kind"     → ValidationIssue.category  ('naming'|'existence'|'circularity'|'metadata'|'schema')
 *   "severity" → ValidationIssue.severity  ('error'|'warning'|'info')
 *   "target"   → ValidationIssue.path      (dot-path string)
 * Assertions use the actual field names from the type definition.
 *
 * Coverage:
 *   §9.1 rule 1  — class names PascalCase (warning)
 *   §9.1 rule 2  — slot/attribute names snake_case (warning)
 *   §9.1 rule 3  — is_a target must exist in scope (error)
 *   §9.1 rule 4  — range target must exist or be built-in (error)
 *   §9.1 rule 5  — circular inheritance (error)
 *   §9.1 rule 6a — schema id required (error)
 *   §9.1 rule 6b — schema name required (error)
 *   §9.1 rule 6c — default_prefix recommended (warning)
 *   Extra        — mixin existence, enum naming, enum empty values,
 *                  class/enum/schema description (info), external-name bypass,
 *                  range resolves to schema-defined class or enum or type
 *
 * §9.2 metamodel-level JSON Schema validation is NOT yet implemented in the
 * codebase; see it.todo blocks at the bottom of this file.
 */
import { describe, it, expect } from 'vitest';
import {
  validateSchemaFull,
  validateClass,
  validateEnum,
  type ValidationIssue,
} from '../../validation/index.js';
import {
  emptySchema,
  emptyClassDefinition,
  emptyEnumDefinition,
  type LinkMLSchema,
} from '../../model/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseSchema(): LinkMLSchema {
  return emptySchema('TestSchema', 'https://example.org/test', 'test');
}

/** Returns only the (category, severity, path) tuples — stable across runs even
 *  though ValidationIssue.id increments via a global counter. */
function fingerprints(issues: ValidationIssue[]) {
  return issues.map(({ category, severity, path }) => ({ category, severity, path }));
}

function hasIssue(
  issues: ValidationIssue[],
  opts: {
    category: ValidationIssue['category'];
    severity: ValidationIssue['severity'];
    pathContains: string;
  }
): boolean {
  return issues.some(
    (i) =>
      i.category === opts.category &&
      i.severity === opts.severity &&
      i.path.includes(opts.pathContains)
  );
}

// ── Rule table ────────────────────────────────────────────────────────────────

interface RuleCase {
  rule: string;
  category: ValidationIssue['category'];
  severity: ValidationIssue['severity'];
  pathContains: string;
  /** Schema that must NOT trigger the rule. */
  positive(): LinkMLSchema;
  /** Schema that MUST trigger the rule. */
  negative(): LinkMLSchema;
}

const RULE_TABLE: RuleCase[] = [
  // ── §9.1 rule 1: class names PascalCase ────────────────────────────────────
  {
    rule: 'class-naming-pascal-case',
    category: 'naming',
    severity: 'warning',
    pathContains: 'classes.my_bad_class',
    positive() {
      const s = baseSchema();
      s.classes['GoodClass'] = emptyClassDefinition('GoodClass');
      return s;
    },
    negative() {
      const s = baseSchema();
      s.classes['my_bad_class'] = emptyClassDefinition('my_bad_class');
      return s;
    },
  },
  // ── §9.1 rule 2: slot/attribute names snake_case ───────────────────────────
  {
    rule: 'slot-naming-snake-case',
    category: 'naming',
    severity: 'warning',
    pathContains: 'attributes.BadSlot',
    positive() {
      const s = baseSchema();
      const cls = emptyClassDefinition('MyClass');
      cls.attributes['good_slot'] = { name: 'good_slot' };
      s.classes['MyClass'] = cls;
      return s;
    },
    negative() {
      const s = baseSchema();
      const cls = emptyClassDefinition('MyClass');
      cls.attributes['BadSlot'] = { name: 'BadSlot' };
      s.classes['MyClass'] = cls;
      return s;
    },
  },
  // ── §9.1 rule 3: is_a target must exist ────────────────────────────────────
  {
    rule: 'is-a-existence',
    category: 'existence',
    severity: 'error',
    pathContains: 'classes.Child.is_a',
    positive() {
      const s = baseSchema();
      const parent = emptyClassDefinition('Parent');
      const child = emptyClassDefinition('Child');
      child.isA = 'Parent';
      s.classes['Parent'] = parent;
      s.classes['Child'] = child;
      return s;
    },
    negative() {
      const s = baseSchema();
      const cls = emptyClassDefinition('Child');
      cls.isA = 'GhostParent';
      s.classes['Child'] = cls;
      return s;
    },
  },
  // ── §9.1 rule 4: range target must exist or be a built-in type ─────────────
  {
    rule: 'range-existence',
    category: 'existence',
    severity: 'error',
    pathContains: 'attributes.my_slot.range',
    positive() {
      const s = baseSchema();
      const cls = emptyClassDefinition('MyClass');
      cls.attributes['my_slot'] = { name: 'my_slot', range: 'string' };
      s.classes['MyClass'] = cls;
      return s;
    },
    negative() {
      const s = baseSchema();
      const cls = emptyClassDefinition('MyClass');
      cls.attributes['my_slot'] = { name: 'my_slot', range: 'NoSuchType' };
      s.classes['MyClass'] = cls;
      return s;
    },
  },
  // ── §9.1 rule 5: circular inheritance ──────────────────────────────────────
  {
    rule: 'circular-inheritance',
    category: 'circularity',
    severity: 'error',
    pathContains: 'is_a',
    positive() {
      const s = baseSchema();
      const a = emptyClassDefinition('Alpha');
      const b = emptyClassDefinition('Beta');
      b.isA = 'Alpha';
      s.classes['Alpha'] = a;
      s.classes['Beta'] = b;
      return s;
    },
    negative() {
      const s = baseSchema();
      const a = emptyClassDefinition('Alpha');
      const b = emptyClassDefinition('Beta');
      a.isA = 'Beta';
      b.isA = 'Alpha'; // cycle
      s.classes['Alpha'] = a;
      s.classes['Beta'] = b;
      return s;
    },
  },
  // ── §9.1 rule 6a: schema id required ───────────────────────────────────────
  {
    rule: 'schema-id-required',
    category: 'schema',
    severity: 'error',
    pathContains: 'id',
    positive: baseSchema,
    negative() {
      return { ...baseSchema(), id: '' };
    },
  },
  // ── §9.1 rule 6b: schema name required ─────────────────────────────────────
  {
    rule: 'schema-name-required',
    category: 'schema',
    severity: 'error',
    pathContains: 'name',
    positive: baseSchema,
    negative() {
      return { ...baseSchema(), name: '' };
    },
  },
  // ── §9.1 rule 6c: default_prefix recommended ───────────────────────────────
  {
    rule: 'schema-default-prefix',
    category: 'metadata',
    severity: 'warning',
    pathContains: 'default_prefix',
    positive: baseSchema,
    negative() {
      return { ...baseSchema(), defaultPrefix: '' };
    },
  },
  // ── Extra: mixin references must exist ─────────────────────────────────────
  {
    rule: 'mixin-existence',
    category: 'existence',
    severity: 'error',
    pathContains: 'classes.MyClass.mixins',
    positive() {
      const s = baseSchema();
      const mixin = emptyClassDefinition('HasName');
      mixin.mixin = true;
      const cls = emptyClassDefinition('MyClass');
      cls.mixins = ['HasName'];
      s.classes['HasName'] = mixin;
      s.classes['MyClass'] = cls;
      return s;
    },
    negative() {
      const s = baseSchema();
      const cls = emptyClassDefinition('MyClass');
      cls.mixins = ['NoSuchMixin'];
      s.classes['MyClass'] = cls;
      return s;
    },
  },
  // ── Extra: enum names PascalCase ───────────────────────────────────────────
  {
    rule: 'enum-naming-pascal-case',
    category: 'naming',
    severity: 'warning',
    pathContains: 'enums.bad_enum',
    positive() {
      const s = baseSchema();
      s.enums['GoodEnum'] = emptyEnumDefinition('GoodEnum');
      return s;
    },
    negative() {
      const s = baseSchema();
      s.enums['bad_enum'] = emptyEnumDefinition('bad_enum');
      return s;
    },
  },
  // ── Extra: enum should have permissible values ──────────────────────────────
  {
    rule: 'enum-empty-values',
    category: 'metadata',
    severity: 'warning',
    pathContains: 'enums.MyEnum.permissible_values',
    positive() {
      const s = baseSchema();
      s.enums['MyEnum'] = {
        ...emptyEnumDefinition('MyEnum'),
        permissibleValues: { active: { text: 'active' } },
      };
      return s;
    },
    negative() {
      const s = baseSchema();
      s.enums['MyEnum'] = emptyEnumDefinition('MyEnum');
      return s;
    },
  },
];

// ── Generated test suites ─────────────────────────────────────────────────────

describe('§9.1 validation rules (table-driven)', () => {
  for (const tc of RULE_TABLE) {
    describe(`rule: ${tc.rule}`, () => {
      it('positive: compliant schema produces no matching issue', () => {
        const issues = validateSchemaFull(tc.positive());
        expect(
          hasIssue(issues, {
            category: tc.category,
            severity: tc.severity,
            pathContains: tc.pathContains,
          })
        ).toBe(false);
      });

      it('negative: non-compliant schema raises the expected issue', () => {
        const issues = validateSchemaFull(tc.negative());
        expect(
          hasIssue(issues, {
            category: tc.category,
            severity: tc.severity,
            pathContains: tc.pathContains,
          })
        ).toBe(true);
      });

      it('idempotency: same schema validated twice yields identical (category, severity, path) tuples', () => {
        const schema = tc.negative();
        const first = fingerprints(validateSchemaFull(schema));
        const second = fingerprints(validateSchemaFull(schema));
        expect(first).toEqual(second);
      });
    });
  }
});

// ── Metadata info-level rules ─────────────────────────────────────────────────

describe('metadata info rules', () => {
  it('schema description missing → info', () => {
    const issues = validateSchemaFull(baseSchema()); // no description
    expect(hasIssue(issues, { category: 'metadata', severity: 'info', pathContains: 'description' })).toBe(true);
  });

  it('schema with description → no description info', () => {
    const s = { ...baseSchema(), description: 'A description' };
    const infos = validateSchemaFull(s).filter(
      (i) => i.category === 'metadata' && i.severity === 'info' && i.path === 'description'
    );
    expect(infos).toHaveLength(0);
  });

  it('class without description → info', () => {
    const s = baseSchema();
    s.classes['MyClass'] = emptyClassDefinition('MyClass'); // no description
    const issues = validateSchemaFull(s);
    expect(
      hasIssue(issues, {
        category: 'metadata',
        severity: 'info',
        pathContains: 'classes.MyClass.description',
      })
    ).toBe(true);
  });

  it('enum without description → info', () => {
    const s = baseSchema();
    s.enums['MyEnum'] = {
      ...emptyEnumDefinition('MyEnum'),
      permissibleValues: { a: { text: 'a' } },
    };
    const issues = validateSchemaFull(s);
    expect(
      hasIssue(issues, {
        category: 'metadata',
        severity: 'info',
        pathContains: 'enums.MyEnum.description',
      })
    ).toBe(true);
  });
});

// ── Range resolution edge cases ───────────────────────────────────────────────

describe('range resolution', () => {
  it('all built-in scalar types are accepted as range', () => {
    const builtins = [
      'string', 'integer', 'float', 'double', 'boolean',
      'date', 'datetime', 'time', 'uri', 'uriorcurie', 'curie',
      'ncname', 'objectidentifier', 'nodeidentifier',
      'jsonpointer', 'jsonpath', 'sparqlpath', 'Any',
    ];
    for (const t of builtins) {
      const s = baseSchema();
      const cls = emptyClassDefinition('MyClass');
      cls.attributes['my_slot'] = { name: 'my_slot', range: t };
      s.classes['MyClass'] = cls;
      const rangeErrors = validateSchemaFull(s).filter(
        (i) => i.category === 'existence' && i.path.includes('my_slot.range')
      );
      expect(rangeErrors, `built-in type '${t}' should be accepted`).toHaveLength(0);
    }
  });

  it('range resolving to a class defined in the same schema is accepted', () => {
    const s = baseSchema();
    s.classes['Target'] = emptyClassDefinition('Target');
    const cls = emptyClassDefinition('MyClass');
    cls.attributes['ref'] = { name: 'ref', range: 'Target' };
    s.classes['MyClass'] = cls;
    const rangeErrors = validateSchemaFull(s).filter(
      (i) => i.category === 'existence' && i.path.includes('ref.range')
    );
    expect(rangeErrors).toHaveLength(0);
  });

  it('range resolving to an enum defined in the same schema is accepted', () => {
    const s = baseSchema();
    s.enums['StatusEnum'] = {
      ...emptyEnumDefinition('StatusEnum'),
      permissibleValues: { active: { text: 'active' } },
    };
    const cls = emptyClassDefinition('MyClass');
    cls.attributes['status'] = { name: 'status', range: 'StatusEnum' };
    s.classes['MyClass'] = cls;
    const rangeErrors = validateSchemaFull(s).filter(
      (i) => i.category === 'existence' && i.path.includes('status.range')
    );
    expect(rangeErrors).toHaveLength(0);
  });

  it('range resolving to a schema-level type is accepted', () => {
    const s = baseSchema();
    s.types['MyType'] = { name: 'MyType', uri: 'xsd:string' };
    const cls = emptyClassDefinition('MyClass');
    cls.attributes['val'] = { name: 'val', range: 'MyType' };
    s.classes['MyClass'] = cls;
    const rangeErrors = validateSchemaFull(s).filter(
      (i) => i.category === 'existence' && i.path.includes('val.range')
    );
    expect(rangeErrors).toHaveLength(0);
  });

  it('range resolving to an external class via externalNames is accepted', () => {
    const s = baseSchema();
    const cls = emptyClassDefinition('MyClass');
    cls.attributes['imported'] = { name: 'imported', range: 'ImportedClass' };
    s.classes['MyClass'] = cls;
    const externalNames = {
      classes: new Set(['ImportedClass']),
      enums: new Set<string>(),
    };
    const rangeErrors = validateSchemaFull(s, externalNames).filter(
      (i) => i.category === 'existence' && i.path.includes('imported.range')
    );
    expect(rangeErrors).toHaveLength(0);
  });
});

// ── ExternalNames: prevents false-positive existence errors ──────────────────

describe('externalNames bypass', () => {
  it('is_a referencing an external class does not error', () => {
    const s = baseSchema();
    const cls = emptyClassDefinition('Child');
    cls.isA = 'ExternalBase';
    s.classes['Child'] = cls;
    const issues = validateSchemaFull(s, {
      classes: new Set(['ExternalBase']),
      enums: new Set(),
    });
    expect(issues.filter((i) => i.category === 'existence' && i.path.includes('Child.is_a'))).toHaveLength(0);
  });

  it('mixin referencing an external class does not error', () => {
    const s = baseSchema();
    const cls = emptyClassDefinition('MyClass');
    cls.mixins = ['ExternalMixin'];
    s.classes['MyClass'] = cls;
    const issues = validateSchemaFull(s, {
      classes: new Set(['ExternalMixin']),
      enums: new Set(),
    });
    expect(issues.filter((i) => i.category === 'existence' && i.path.includes('MyClass.mixins'))).toHaveLength(0);
  });
});

// ── validateClass scoped helper ───────────────────────────────────────────────

describe('validateClass', () => {
  it('returns only issues for the specified class', () => {
    const s = baseSchema();
    s.classes['bad_class'] = emptyClassDefinition('bad_class'); // naming
    s.classes['GoodClass'] = emptyClassDefinition('GoodClass');
    const issues = validateClass('bad_class', s);
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      const isForClass = issue.path.includes('bad_class');
      const isCircularity = issue.category === 'circularity';
      expect(isForClass || isCircularity).toBe(true);
    }
  });

  it('returns no issues for a valid class', () => {
    const s = baseSchema();
    const cls = emptyClassDefinition('GoodClass');
    cls.description = 'A well-formed class';
    s.classes['GoodClass'] = cls;
    const issues = validateClass('GoodClass', s);
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

// ── validateEnum scoped helper ────────────────────────────────────────────────

describe('validateEnum', () => {
  it('returns only issues for the specified enum', () => {
    const s = baseSchema();
    s.enums['bad_enum'] = emptyEnumDefinition('bad_enum'); // naming + empty values
    s.enums['GoodEnum'] = {
      ...emptyEnumDefinition('GoodEnum'),
      permissibleValues: { a: { text: 'a' } },
    };
    const issues = validateEnum('bad_enum', s);
    for (const issue of issues) {
      expect(issue.path.startsWith('enums.bad_enum')).toBe(true);
    }
  });
});

// ── §9.2 — Metamodel JSON Schema validation (not yet implemented) ─────────────

describe('§9.2 metamodel validation (TODO)', () => {
  it.todo('corpus schemas validate against the LinkML metamodel JSON Schema (pinned version)');
  it.todo('hand-crafted invalid schema (missing required linkml fields) fails metamodel validation');
});
