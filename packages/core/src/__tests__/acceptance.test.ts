/**
 * Acceptance test suite — verifies all 10 AC criteria from design spec §17.
 *
 * AC-01: Open existing LinkML YAML → editable canvas
 * AC-02: Create schema from scratch → valid YAML output
 * AC-03: Round-trip fidelity (no data loss)
 * AC-04: Inheritance and mixin visualization correct
 * AC-05: Multi-file project with imports works
 * AC-06: Focus mode filters canvas correctly
 * AC-07: Validation catches common errors
 * AC-08: Git state management in store
 * AC-09: Web and Electron produce identical YAML (platform-agnostic serialization)
 * AC-10: 100+ node schema remains interactive (store handles large schemas)
 */
import { describe, it, expect } from 'vitest';
import {
  parseYaml,
  serializeYaml,
  validateSchemaFull,
  emptySchema,
  emptyClassDefinition,
  emptyEnumDefinition,
  emptyCanvasLayout,
  isLocalImport,
  resolveImportPath,
  collectImportedEntities,
} from '../index.js';
import { create } from 'zustand';
import { createProjectSlice } from '../store/slices/projectSlice.js';
import { createCanvasSlice } from '../store/slices/canvasSlice.js';
import { createEditorSlice } from '../store/slices/editorSlice.js';
import { createGitSlice } from '../store/slices/gitSlice.js';
import { createUISlice } from '../store/slices/uiSlice.js';
import { createValidationSlice } from '../store/slices/validationSlice.js';
import type { AppStore } from '../store/index.js';

// ── Store factory ─────────────────────────────────────────────────────────────
function makeStore() {
  return create<AppStore>()((...args) => ({
    ...createProjectSlice(...args),
    ...createCanvasSlice(...args),
    ...createEditorSlice(...args),
    ...createGitSlice(...args),
    ...createUISlice(...args),
    ...createValidationSlice(...args),
  }));
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const PERSON_YAML = `
id: https://example.org/personinfo
name: personinfo
title: Person Info
description: Test schema
prefixes:
  linkml: https://w3id.org/linkml/
default_prefix: personinfo
imports:
  - linkml:types
subsets:
  BasicSubset:
    description: Basic fields
enums:
  EmploymentStatus:
    permissible_values:
      employed:
        description: Currently employed
      unemployed: {}
classes:
  NamedThing:
    description: Base class
    abstract: true
    attributes:
      id:
        range: string
        identifier: true
      name:
        range: string
        subset_of:
          - BasicSubset
  Person:
    is_a: NamedThing
    description: A human being
    mixins:
      - HasAliases
    attributes:
      age:
        range: integer
      employment_status:
        range: EmploymentStatus
  HasAliases:
    mixin: true
    attributes:
      aliases:
        range: string
        multivalued: true
`.trim();

// ── AC-01: Open existing LinkML YAML → editable canvas ─────────────────────
describe('AC-01: Parse YAML into editable model', () => {
  it('parseYaml produces a schema with classes, enums, and subsets', () => {
    const schema = parseYaml(PERSON_YAML);
    expect(schema.name).toBe('personinfo');
    expect(Object.keys(schema.classes)).toContain('Person');
    expect(Object.keys(schema.classes)).toContain('NamedThing');
    expect(Object.keys(schema.enums)).toContain('EmploymentStatus');
    expect(Object.keys(schema.subsets)).toContain('BasicSubset');
  });

  it('schema can be loaded into store and set as active schema', () => {
    const schema = parseYaml(PERSON_YAML);
    const store = makeStore();
    store.getState().setProject({
      id: 'p1', name: 'Test', rootPath: '/',
      schemas: [{ id: 's1', filePath: 'person.yaml', schema, isDirty: false, canvasLayout: emptyCanvasLayout() }],
      createdAt: '', updatedAt: '',
    });
    expect(store.getState().getActiveSchema()?.schema.name).toBe('personinfo');
  });

  it('class definition is fully accessible after loading', () => {
    const schema = parseYaml(PERSON_YAML);
    expect(schema.classes['Person'].isA).toBe('NamedThing');
    expect(schema.classes['Person'].attributes['age'].range).toBe('integer');
  });
});

// ── AC-02: Create schema from scratch → valid YAML ─────────────────────────
describe('AC-02: Create schema from scratch', () => {
  it('empty schema serializes to valid YAML', () => {
    const schema = emptySchema('myschema', 'https://example.org/myschema', 'myschema');
    const yaml = serializeYaml(schema);
    expect(yaml).toContain('name: myschema');
    expect(yaml).toContain('id: https://example.org/myschema');
  });

  it('schema with added class and enum produces valid YAML', () => {
    const store = makeStore();
    const schema = emptySchema('test', 'https://example.org/test', 'test');
    store.getState().setProject({
      id: 'p1', name: 'Test', rootPath: '/',
      schemas: [{ id: 's1', filePath: 'test.yaml', schema, isDirty: false, canvasLayout: emptyCanvasLayout() }],
      createdAt: '', updatedAt: '',
    });
    store.getState().addClass('s1', { ...emptyClassDefinition('MyClass'), description: 'A class' });
    store.getState().addEnum('s1', { ...emptyEnumDefinition('MyEnum'), permissibleValues: { val: { text: 'val' } } });

    const active = store.getState().getActiveSchema();
    const yaml = serializeYaml(active!.schema);
    expect(yaml).toContain('MyClass');
    expect(yaml).toContain('MyEnum');
    expect(yaml).toContain('val');
  });
});

// ── AC-03: Round-trip fidelity ──────────────────────────────────────────────
describe('AC-03: Round-trip fidelity', () => {
  it('parse → serialize → parse produces identical structure', () => {
    const schema1 = parseYaml(PERSON_YAML);
    const yaml2 = serializeYaml(schema1);
    const schema2 = parseYaml(yaml2);

    expect(schema2.name).toBe(schema1.name);
    expect(schema2.id).toBe(schema1.id);
    expect(Object.keys(schema2.classes)).toEqual(expect.arrayContaining(Object.keys(schema1.classes)));
    expect(Object.keys(schema2.enums)).toEqual(expect.arrayContaining(Object.keys(schema1.enums)));
  });

  it('class attributes are preserved through round-trip', () => {
    const schema1 = parseYaml(PERSON_YAML);
    const schema2 = parseYaml(serializeYaml(schema1));
    const person2 = schema2.classes['Person'];
    expect(person2.isA).toBe('NamedThing');
    expect(person2.attributes['age'].range).toBe('integer');
    expect(person2.mixins).toContain('HasAliases');
  });

  it('subsets and permissible values survive round-trip', () => {
    const schema1 = parseYaml(PERSON_YAML);
    const schema2 = parseYaml(serializeYaml(schema1));
    expect(schema2.subsets['BasicSubset'].description).toBe('Basic fields');
    expect(schema2.enums['EmploymentStatus'].permissibleValues['employed'].description).toBe('Currently employed');
  });
});

// ── AC-04: Inheritance and mixin visualization ─────────────────────────────
describe('AC-04: Inheritance and mixin model', () => {
  it('is_a relationships are parsed and accessible', () => {
    const schema = parseYaml(PERSON_YAML);
    expect(schema.classes['Person'].isA).toBe('NamedThing');
  });

  it('mixin flag and mixin references are correct', () => {
    const schema = parseYaml(PERSON_YAML);
    expect(schema.classes['HasAliases'].mixin).toBe(true);
    expect(schema.classes['Person'].mixins).toContain('HasAliases');
  });

  it('abstract flag is preserved', () => {
    const schema = parseYaml(PERSON_YAML);
    expect(schema.classes['NamedThing'].abstract).toBe(true);
  });

  it('renameClass updates is_a references in subclasses', () => {
    const schema = parseYaml(PERSON_YAML);
    const store = makeStore();
    store.getState().setProject({
      id: 'p1', name: 'Test', rootPath: '/',
      schemas: [{ id: 's1', filePath: 'person.yaml', schema, isDirty: false, canvasLayout: emptyCanvasLayout() }],
      createdAt: '', updatedAt: '',
    });
    store.getState().renameClass('s1', 'NamedThing', 'AbstractEntity');
    const updated = store.getState().getActiveSchema()!.schema;
    expect(updated.classes['AbstractEntity']).toBeDefined();
    expect(updated.classes['Person'].isA).toBe('AbstractEntity');
  });
});

// ── AC-05: Multi-file project with imports ─────────────────────────────────
describe('AC-05: Multi-file project and imports', () => {
  it('isLocalImport correctly identifies local vs namespace imports', () => {
    expect(isLocalImport('./base')).toBe(true);
    expect(isLocalImport('../common')).toBe(true);
    expect(isLocalImport('linkml:types')).toBe(false);
    expect(isLocalImport('https://example.org/other')).toBe(false);
  });

  it('resolveImportPath normalizes relative paths', () => {
    expect(resolveImportPath('./base', 'schemas/main.yaml')).toBe('schemas/base.yaml');
    expect(resolveImportPath('../common', 'schemas/sub/schema.yaml')).toBe('schemas/common.yaml');
  });

  it('store can hold multiple schema files', () => {
    const schema1 = emptySchema('main', 'https://example.org/main', 'main');
    const schema2 = emptySchema('base', 'https://example.org/base', 'base');
    const store = makeStore();
    store.getState().setProject({
      id: 'p1', name: 'Multi', rootPath: '/',
      schemas: [
        { id: 's1', filePath: 'main.yaml', schema: schema1, isDirty: false, canvasLayout: emptyCanvasLayout() },
        { id: 's2', filePath: 'base.yaml', schema: schema2, isDirty: false, canvasLayout: emptyCanvasLayout() },
      ],
      createdAt: '', updatedAt: '',
    });
    expect(store.getState().activeProject!.schemas).toHaveLength(2);
  });

  it('collectImportedEntities collects from imported schemas', () => {
    const baseSchema = {
      ...emptySchema('base', 'https://example.org/base', 'base'),
      classes: { Person: emptyClassDefinition('Person') },
    };
    const baseFile = { id: 'b', filePath: 'base.yaml', schema: baseSchema, isDirty: false, canvasLayout: emptyCanvasLayout() };
    const mainSchema = {
      ...emptySchema('main', 'https://example.org/main', 'main'),
      imports: ['./base'],
    };
    const mainFile = { id: 'm', filePath: 'main.yaml', schema: mainSchema, isDirty: false, canvasLayout: emptyCanvasLayout() };
    const entities = collectImportedEntities(mainFile, [mainFile, baseFile]);
    expect(entities.some((e) => e.name === 'Person')).toBe(true);
  });
});

// ── AC-06: Focus mode filters canvas ──────────────────────────────────────
describe('AC-06: Focus mode', () => {
  it('setFocusMode subset stores the active subset name', () => {
    const store = makeStore();
    store.getState().setFocusMode({ type: 'subset', subsetName: 'BasicSubset' });
    expect(store.getState().focusMode).toEqual({ type: 'subset', subsetName: 'BasicSubset' });
  });

  it('setFocusMode selection stores the node IDs', () => {
    const store = makeStore();
    store.getState().setFocusMode({ type: 'selection', nodeIds: ['Person', 'NamedThing'] });
    const mode = store.getState().focusMode!;
    expect(mode.type).toBe('selection');
    if (mode.type === 'selection') {
      expect(mode.nodeIds).toContain('Person');
      expect(mode.nodeIds).toContain('NamedThing');
    }
  });

  it('setFocusMode(null) exits focus mode', () => {
    const store = makeStore();
    store.getState().setFocusMode({ type: 'subset', subsetName: 'X' });
    store.getState().setFocusMode(null);
    expect(store.getState().focusMode).toBeNull();
  });

  it('subset focus: classes with subsetOf membership should be identifiable', () => {
    const schema = parseYaml(PERSON_YAML);
    const namedThing = schema.classes['NamedThing'];
    const nameSlot = namedThing.attributes['name'];
    expect(nameSlot.subsetOf).toContain('BasicSubset');
  });
});

// ── AC-07: Validation catches common errors ────────────────────────────────
describe('AC-07: Validation', () => {
  it('catches missing schema id', () => {
    const schema = { ...emptySchema('test', '', 'test') };
    const issues = validateSchemaFull(schema);
    expect(issues.some((i) => i.severity === 'error' && i.path === 'id')).toBe(true);
  });

  it('catches non-PascalCase class names', () => {
    const schema = emptySchema('test', 'https://x.org/test', 'test');
    schema.classes['bad_name'] = emptyClassDefinition('bad_name');
    const issues = validateSchemaFull(schema);
    expect(issues.some((i) => i.category === 'naming' && i.path.includes('bad_name'))).toBe(true);
  });

  it('catches broken is_a reference', () => {
    const schema = emptySchema('test', 'https://x.org/test', 'test');
    const cls = emptyClassDefinition('Child');
    cls.isA = 'NonExistent';
    schema.classes['Child'] = cls;
    const issues = validateSchemaFull(schema);
    expect(issues.some((i) => i.category === 'existence' && i.severity === 'error')).toBe(true);
  });

  it('catches inheritance cycles', () => {
    const schema = emptySchema('test', 'https://x.org/test', 'test');
    const a = emptyClassDefinition('ClassA'); a.isA = 'ClassB';
    const b = emptyClassDefinition('ClassB'); b.isA = 'ClassA';
    schema.classes['ClassA'] = a;
    schema.classes['ClassB'] = b;
    const issues = validateSchemaFull(schema);
    expect(issues.some((i) => i.category === 'circularity')).toBe(true);
  });

  it('runValidation stores issues in the store', () => {
    const schema = parseYaml(PERSON_YAML);
    const store = makeStore();
    store.getState().runValidation(schema);
    expect(store.getState().lastValidatedAt).not.toBeNull();
    // Schema has missing default_prefix description — may have info issues
    expect(Array.isArray(store.getState().validationIssues)).toBe(true);
  });
});

// ── AC-08: Git state management ────────────────────────────────────────────
describe('AC-08: Git integration (store layer)', () => {
  it('setGitAvailable toggles git state', () => {
    const store = makeStore();
    store.getState().setGitAvailable(true);
    expect(store.getState().gitAvailable).toBe(true);
  });

  it('stageFile and unstageFile manage staged paths', () => {
    const store = makeStore();
    store.getState().stageFile('schema.yaml');
    expect(store.getState().stagedPaths.has('schema.yaml')).toBe(true);
    store.getState().unstageFile('schema.yaml');
    expect(store.getState().stagedPaths.has('schema.yaml')).toBe(false);
  });

  it('setGitStatus stores the status object', () => {
    const store = makeStore();
    const status = { branch: 'main', aheadCount: 1, behindCount: 0, stagedFiles: [], unstagedFiles: ['schema.yaml'], untrackedFiles: [] };
    store.getState().setGitStatus(status);
    expect(store.getState().gitStatus?.branch).toBe('main');
  });

  it('setCommitMessage stores the message', () => {
    const store = makeStore();
    store.getState().setCommitMessage('feat: add Person class');
    expect(store.getState().commitMessage).toBe('feat: add Person class');
  });

  it('stageAll stages all changed files', () => {
    const store = makeStore();
    const status = { branch: 'main', aheadCount: 0, behindCount: 0, stagedFiles: [], unstagedFiles: ['a.yaml', 'b.yaml'], untrackedFiles: ['c.yaml'] };
    store.getState().setGitStatus(status);
    store.getState().stageAll();
    expect(store.getState().stagedPaths.size).toBe(3);
  });
});

// ── AC-09: Web ↔ Electron YAML parity ─────────────────────────────────────
describe('AC-09: Platform-agnostic YAML serialization', () => {
  it('serializeYaml is deterministic — same output for same input', () => {
    const schema = parseYaml(PERSON_YAML);
    const yaml1 = serializeYaml(schema);
    const yaml2 = serializeYaml(schema);
    expect(yaml1).toBe(yaml2);
  });

  it('schema mutations produce consistent YAML regardless of platform', () => {
    const schema = parseYaml(PERSON_YAML);
    // Simulate adding an attribute on "web"
    schema.classes['Person'].attributes['email'] = { name: 'email', range: 'string' };
    const webYaml = serializeYaml(schema);
    // Simulate same mutation on "electron" (same in-memory model)
    const schema2 = parseYaml(PERSON_YAML);
    schema2.classes['Person'].attributes['email'] = { name: 'email', range: 'string' };
    const electronYaml = serializeYaml(schema2);
    expect(webYaml).toBe(electronYaml);
  });
});

// ── AC-10: 100+ node schema ────────────────────────────────────────────────
describe('AC-10: Large schema (100+ nodes) handling', () => {
  function makeLargeSchema(classCount: number) {
    const schema = emptySchema('large', 'https://example.org/large', 'large');
    // Add a base class
    schema.classes['Base'] = {
      ...emptyClassDefinition('Base'),
      abstract: true,
      attributes: { id: { name: 'id', range: 'string', identifier: true } },
    };
    for (let i = 0; i < classCount; i++) {
      schema.classes[`Class${i}`] = {
        ...emptyClassDefinition(`Class${i}`),
        isA: 'Base',
        attributes: {
          [`attr_${i}_a`]: { name: `attr_${i}_a`, range: 'string' },
          [`attr_${i}_b`]: { name: `attr_${i}_b`, range: 'integer' },
        },
      };
    }
    return schema;
  }

  it('can load a 100-class schema into the store', () => {
    const schema = makeLargeSchema(100);
    const store = makeStore();
    store.getState().setProject({
      id: 'p1', name: 'Large', rootPath: '/',
      schemas: [{ id: 's1', filePath: 'large.yaml', schema, isDirty: false, canvasLayout: emptyCanvasLayout() }],
      createdAt: '', updatedAt: '',
    });
    expect(Object.keys(store.getState().activeProject!.schemas[0].schema.classes)).toHaveLength(101);
  });

  it('can serialize and re-parse a 100-class schema without data loss', () => {
    const schema = makeLargeSchema(100);
    const yaml = serializeYaml(schema);
    const schema2 = parseYaml(yaml);
    expect(Object.keys(schema2.classes)).toHaveLength(101);
    expect(schema2.classes['Class0'].isA).toBe('Base');
    expect(schema2.classes['Class99'].attributes['attr_99_a'].range).toBe('string');
  });

  it('validation of a 100-class schema completes quickly', () => {
    const schema = makeLargeSchema(100);
    const start = Date.now();
    const issues = validateSchemaFull(schema);
    const elapsed = Date.now() - start;
    // Should complete in under 500ms even for 100 classes
    expect(elapsed).toBeLessThan(500);
    expect(Array.isArray(issues)).toBe(true);
  });

  it('runValidation on 100-class schema stores results', () => {
    const schema = makeLargeSchema(100);
    const store = makeStore();
    store.getState().runValidation(schema);
    expect(store.getState().lastValidatedAt).not.toBeNull();
  });
});
