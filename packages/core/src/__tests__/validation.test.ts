import { describe, it, expect } from 'vitest';
import { validateSchemaFull, validateClass } from '../validation/index.js';
import { emptySchema, emptyClassDefinition, emptyEnumDefinition } from '../model/index.js';

function makeSchema() {
  return emptySchema('TestSchema', 'https://example.org/test', 'test');
}

describe('validateSchemaFull', () => {
  it('reports no issues for a minimal valid schema', () => {
    const schema = {
      ...makeSchema(),
      description: 'A test schema',
    };
    const issues = validateSchemaFull(schema);
    // Only info-level issues for missing descriptions on classes/enums (none here)
    const errors = issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('flags missing schema id', () => {
    const schema = { ...makeSchema(), id: '' };
    const issues = validateSchemaFull(schema);
    expect(issues.some((i) => i.path === 'id' && i.severity === 'error')).toBe(true);
  });

  it('flags missing schema name', () => {
    const schema = { ...makeSchema(), name: '' };
    const issues = validateSchemaFull(schema);
    expect(issues.some((i) => i.path === 'name' && i.severity === 'error')).toBe(true);
  });

  it('warns about non-PascalCase class name', () => {
    const schema = makeSchema();
    schema.classes['my_class'] = emptyClassDefinition('my_class');
    const issues = validateSchemaFull(schema);
    expect(
      issues.some(
        (i) =>
          i.category === 'naming' &&
          i.severity === 'warning' &&
          i.path.includes('my_class')
      )
    ).toBe(true);
  });

  it('accepts PascalCase class names without naming warnings', () => {
    const schema = makeSchema();
    schema.classes['MyClass'] = emptyClassDefinition('MyClass');
    const issues = validateSchemaFull(schema);
    const namingWarnings = issues.filter(
      (i) => i.category === 'naming' && i.path.includes('MyClass')
    );
    expect(namingWarnings).toHaveLength(0);
  });

  it('warns about non-snake_case slot names', () => {
    const schema = makeSchema();
    const cls = emptyClassDefinition('MyClass');
    cls.attributes['BadName'] = { name: 'BadName' };
    schema.classes['MyClass'] = cls;
    const issues = validateSchemaFull(schema);
    expect(
      issues.some(
        (i) => i.category === 'naming' && i.path.includes('BadName')
      )
    ).toBe(true);
  });

  it('accepts snake_case slot names', () => {
    const schema = makeSchema();
    const cls = emptyClassDefinition('MyClass');
    cls.attributes['my_slot'] = { name: 'my_slot', range: 'string' };
    schema.classes['MyClass'] = cls;
    const issues = validateSchemaFull(schema);
    const naming = issues.filter(
      (i) => i.category === 'naming' && i.path.includes('my_slot')
    );
    expect(naming).toHaveLength(0);
  });

  it('errors on missing is_a target', () => {
    const schema = makeSchema();
    const cls = emptyClassDefinition('Child');
    cls.isA = 'NonExistentParent';
    schema.classes['Child'] = cls;
    const issues = validateSchemaFull(schema);
    expect(
      issues.some(
        (i) => i.category === 'existence' && i.severity === 'error' && i.path.includes('Child')
      )
    ).toBe(true);
  });

  it('errors on missing range reference', () => {
    const schema = makeSchema();
    const cls = emptyClassDefinition('MyClass');
    cls.attributes['bad_range'] = { name: 'bad_range', range: 'NonExistentType' };
    schema.classes['MyClass'] = cls;
    const issues = validateSchemaFull(schema);
    expect(
      issues.some(
        (i) => i.category === 'existence' && i.path.includes('bad_range')
      )
    ).toBe(true);
  });

  it('allows built-in types as range', () => {
    const schema = makeSchema();
    const cls = emptyClassDefinition('MyClass');
    cls.attributes['name'] = { name: 'name', range: 'string' };
    cls.attributes['count'] = { name: 'count', range: 'integer' };
    schema.classes['MyClass'] = cls;
    const issues = validateSchemaFull(schema);
    const rangeErrors = issues.filter(
      (i) => i.category === 'existence' && i.path.includes('range')
    );
    expect(rangeErrors).toHaveLength(0);
  });

  it('detects inheritance cycles', () => {
    const schema = makeSchema();
    const a = emptyClassDefinition('ClassA');
    a.isA = 'ClassB';
    const b = emptyClassDefinition('ClassB');
    b.isA = 'ClassA';
    schema.classes['ClassA'] = a;
    schema.classes['ClassB'] = b;
    const issues = validateSchemaFull(schema);
    expect(
      issues.some((i) => i.category === 'circularity' && i.severity === 'error')
    ).toBe(true);
  });

  it('does not flag cycle-free inheritance', () => {
    const schema = makeSchema();
    const parent = emptyClassDefinition('Parent');
    const child = emptyClassDefinition('Child');
    child.isA = 'Parent';
    schema.classes['Parent'] = parent;
    schema.classes['Child'] = child;
    const issues = validateSchemaFull(schema);
    expect(issues.filter((i) => i.category === 'circularity')).toHaveLength(0);
  });

  it('warns about enum with no permissible values', () => {
    const schema = makeSchema();
    schema.enums['StatusEnum'] = emptyEnumDefinition('StatusEnum');
    const issues = validateSchemaFull(schema);
    expect(
      issues.some((i) => i.severity === 'warning' && i.path.includes('StatusEnum'))
    ).toBe(true);
  });

  it('allows enum class ranges', () => {
    const schema = makeSchema();
    schema.enums['StatusEnum'] = {
      ...emptyEnumDefinition('StatusEnum'),
      permissibleValues: { active: { text: 'active' } },
    };
    const cls = emptyClassDefinition('MyClass');
    cls.attributes['status'] = { name: 'status', range: 'StatusEnum' };
    schema.classes['MyClass'] = cls;
    const issues = validateSchemaFull(schema);
    const rangeErrors = issues.filter(
      (i) => i.category === 'existence' && i.path.includes('status')
    );
    expect(rangeErrors).toHaveLength(0);
  });
});

describe('validateClass', () => {
  it('returns only issues for the specified class', () => {
    const schema = makeSchema();
    const cls = emptyClassDefinition('bad_class');  // naming violation
    schema.classes['bad_class'] = cls;
    schema.classes['GoodClass'] = emptyClassDefinition('GoodClass');

    const issues = validateClass('bad_class', schema);
    expect(issues.length).toBeGreaterThan(0);
    // Should not include issues for GoodClass
    expect(issues.every((i) => i.path.includes('bad_class') || i.category === 'circularity')).toBe(true);
  });
});
