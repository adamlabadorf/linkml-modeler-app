import type { StateCreator } from 'zustand';
import type { Project, SchemaFile, LinkMLSchema } from '../../model/index.js';

export interface ProjectSlice {
  // State
  activeProject: Project | null;
  activeSchemaId: string | null;

  // Computed helpers (call these from selectors, not as reactive state)
  getActiveSchema(): SchemaFile | undefined;
  getIsDirty(): boolean;

  // Actions
  setProject(project: Project): void;
  closeProject(): void;
  setActiveSchema(schemaId: string): void;
  updateSchema(schemaId: string, partial: Partial<LinkMLSchema>): void;
  markSchemaDirty(schemaId: string, dirty: boolean): void;
  addSchemaFile(file: SchemaFile): void;
  removeSchemaFile(schemaId: string): void;
}

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set, get) => ({
  activeProject: null,
  activeSchemaId: null,

  getActiveSchema() {
    const { activeProject, activeSchemaId } = get();
    return activeProject?.schemas.find((s) => s.id === activeSchemaId);
  },

  getIsDirty() {
    return get().activeProject?.schemas.some((s) => s.isDirty) ?? false;
  },

  setProject(project) {
    const firstSchemaId = project.schemas[0]?.id ?? null;
    set({ activeProject: project, activeSchemaId: firstSchemaId });
  },

  closeProject() {
    set({ activeProject: null, activeSchemaId: null });
  },

  setActiveSchema(schemaId) {
    set({ activeSchemaId: schemaId });
  },

  updateSchema(schemaId, partial) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: {
          ...state.activeProject,
          schemas: state.activeProject.schemas.map((s) =>
            s.id === schemaId
              ? { ...s, schema: { ...s.schema, ...partial }, isDirty: true }
              : s
          ),
        },
      };
    });
  },

  markSchemaDirty(schemaId, dirty) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: {
          ...state.activeProject,
          schemas: state.activeProject.schemas.map((s) =>
            s.id === schemaId ? { ...s, isDirty: dirty } : s
          ),
        },
      };
    });
  },

  addSchemaFile(file) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: {
          ...state.activeProject,
          schemas: [...state.activeProject.schemas, file],
        },
      };
    });
  },

  removeSchemaFile(schemaId) {
    set((state) => {
      if (!state.activeProject) return state;
      const schemas = state.activeProject.schemas.filter((s) => s.id !== schemaId);
      const activeSchemaId =
        state.activeSchemaId === schemaId ? (schemas[0]?.id ?? null) : state.activeSchemaId;
      return {
        activeProject: { ...state.activeProject, schemas },
        activeSchemaId,
      };
    });
  },
});
