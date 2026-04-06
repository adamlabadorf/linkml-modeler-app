import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { createProjectSlice, type ProjectSlice } from '../store/slices/projectSlice.js';
import type { Project, SchemaFile } from '../model/index.js';
import { emptyCanvasLayout, emptySchema } from '../model/index.js';
function makeSchemaFile(name: string): SchemaFile {
  return {
    id: crypto.randomUUID(),
    filePath: `${name}.yaml`,
    schema: emptySchema(name, `https://example.org/${name}`, name),
    isDirty: false,
    canvasLayout: emptyCanvasLayout(),
  };
}

function makeProject(name: string, schemas: SchemaFile[] = []): Project {
  return {
    id: crypto.randomUUID(),
    name,
    rootPath: `/tmp/${name}`,
    schemas,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createStore() {
  return create<ProjectSlice>()((...args) => createProjectSlice(...args));
}

describe('ProjectSlice', () => {
  it('starts with no active project', () => {
    const store = createStore();
    expect(store.getState().activeProject).toBeNull();
    expect(store.getState().activeSchemaId).toBeNull();
  });

  it('setProject — sets active project and selects first schema', () => {
    const store = createStore();
    const schema = makeSchemaFile('core');
    const project = makeProject('test', [schema]);

    store.getState().setProject(project);

    expect(store.getState().activeProject).toEqual(project);
    expect(store.getState().activeSchemaId).toBe(schema.id);
  });

  it('closeProject — clears project and schema', () => {
    const store = createStore();
    const project = makeProject('test', [makeSchemaFile('core')]);
    store.getState().setProject(project);
    store.getState().closeProject();

    expect(store.getState().activeProject).toBeNull();
    expect(store.getState().activeSchemaId).toBeNull();
  });

  it('setActiveSchema — switches active schema', () => {
    const store = createStore();
    const s1 = makeSchemaFile('s1');
    const s2 = makeSchemaFile('s2');
    const project = makeProject('test', [s1, s2]);
    store.getState().setProject(project);

    store.getState().setActiveSchema(s2.id);
    expect(store.getState().activeSchemaId).toBe(s2.id);
  });

  it('updateSchema — marks schema dirty and updates fields', () => {
    const store = createStore();
    const s = makeSchemaFile('core');
    store.getState().setProject(makeProject('test', [s]));

    store.getState().updateSchema(s.id, { title: 'Updated Title' });

    const updated = store.getState().activeProject!.schemas[0];
    expect(updated.schema.title).toBe('Updated Title');
    expect(updated.isDirty).toBe(true);
  });

  it('updateSchema — updates schema name and produces new activeProject reference (PTS-58)', () => {
    const store = createStore();
    const s = makeSchemaFile('my_schema');
    store.getState().setProject(makeProject('test', [s]));

    const projectBefore = store.getState().activeProject;
    store.getState().updateSchema(s.id, { name: 'new_schema_name' });
    const projectAfter = store.getState().activeProject;

    expect(projectAfter!.schemas[0].schema.name).toBe('new_schema_name');
    expect(projectAfter!.schemas[0].isDirty).toBe(true);
    // New object reference ensures Zustand subscribers (e.g. ProjectPanel) re-render
    expect(projectAfter).not.toBe(projectBefore);
  });

  it('markSchemaDirty — sets dirty flag', () => {
    const store = createStore();
    const s = makeSchemaFile('core');
    store.getState().setProject(makeProject('test', [s]));

    store.getState().markSchemaDirty(s.id, true);
    expect(store.getState().activeProject!.schemas[0].isDirty).toBe(true);

    store.getState().markSchemaDirty(s.id, false);
    expect(store.getState().activeProject!.schemas[0].isDirty).toBe(false);
  });

  it('addSchemaFile — appends a schema file', () => {
    const store = createStore();
    const s1 = makeSchemaFile('s1');
    store.getState().setProject(makeProject('test', [s1]));

    const s2 = makeSchemaFile('s2');
    store.getState().addSchemaFile(s2);

    expect(store.getState().activeProject!.schemas).toHaveLength(2);
    expect(store.getState().activeProject!.schemas[1].id).toBe(s2.id);
  });

  it('removeSchemaFile — removes schema and falls back to next', () => {
    const store = createStore();
    const s1 = makeSchemaFile('s1');
    const s2 = makeSchemaFile('s2');
    store.getState().setProject(makeProject('test', [s1, s2]));
    store.getState().setActiveSchema(s1.id);

    store.getState().removeSchemaFile(s1.id);

    expect(store.getState().activeProject!.schemas).toHaveLength(1);
    expect(store.getState().activeSchemaId).toBe(s2.id);
  });

  it('getIsDirty — reflects any dirty schema', () => {
    const store = createStore();
    const s = makeSchemaFile('core');
    store.getState().setProject(makeProject('test', [s]));

    expect(store.getState().getIsDirty()).toBe(false);
    store.getState().markSchemaDirty(s.id, true);
    expect(store.getState().getIsDirty()).toBe(true);
  });
});
