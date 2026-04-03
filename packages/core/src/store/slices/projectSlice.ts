import type { StateCreator } from 'zustand';
import type { Project, SchemaFile, LinkMLSchema, ClassDefinition, SlotDefinition, EnumDefinition, PermissibleValue } from '../../model/index.js';
import { findMissingImport, resolveImportPath } from '../../io/importResolver.js';
import { addRecentProject } from '../../project/recentProjects.js';

export interface ProjectSlice {
  // State
  activeProject: Project | null;
  activeSchemaId: string | null;

  // Computed helpers (call these from selectors, not as reactive state)
  getActiveSchema(): SchemaFile | undefined;
  getIsDirty(): boolean;

  // Actions
  setProject(project: Project): void;
  /** Close the active project. Returns true if the project had unsaved changes (caller should prompt save). */
  closeProject(): boolean;
  setActiveSchema(schemaId: string): void;
  updateSchema(schemaId: string, partial: Partial<LinkMLSchema>): void;
  markSchemaDirty(schemaId: string, dirty: boolean): void;
  addSchemaFile(file: SchemaFile): void;
  removeSchemaFile(schemaId: string): void;

  // ── Class mutations ──────────────────────────────────────────────────────────
  addClass(schemaId: string, classDef: ClassDefinition): void;
  updateClass(schemaId: string, className: string, partial: Partial<ClassDefinition>): void;
  deleteClass(schemaId: string, className: string): void;
  renameClass(schemaId: string, oldName: string, newName: string): void;

  // ── Slot / attribute mutations ───────────────────────────────────────────────
  addAttribute(schemaId: string, className: string, slot: SlotDefinition): void;
  updateAttribute(schemaId: string, className: string, slotName: string, partial: Partial<SlotDefinition>): void;
  deleteAttribute(schemaId: string, className: string, slotName: string): void;
  renameAttribute(schemaId: string, className: string, oldName: string, newName: string): void;

  // ── Enum mutations ───────────────────────────────────────────────────────────
  addEnum(schemaId: string, enumDef: EnumDefinition): void;
  updateEnum(schemaId: string, enumName: string, partial: Partial<EnumDefinition>): void;
  deleteEnum(schemaId: string, enumName: string): void;
  renameEnum(schemaId: string, oldName: string, newName: string): void;
  addPermissibleValue(schemaId: string, enumName: string, value: PermissibleValue): void;
  updatePermissibleValue(schemaId: string, enumName: string, valueText: string, partial: Partial<PermissibleValue>): void;
  deletePermissibleValue(schemaId: string, enumName: string, valueText: string): void;

  // ── Import management ────────────────────────────────────────────────────────
  /** Add a local import path to the schema's imports list if not already present. */
  addImport(schemaId: string, importPath: string): void;
  /** Remove a local import path if no slot ranges in the schema still reference it. */
  removeImportIfUnused(schemaId: string, importPath: string): boolean;
  /**
   * After adding/updating an attribute range, check if the range lives in
   * another loaded schema and auto-add the import when autoManageImports is on.
   * Returns the import path that was added, or null.
   */
  autoAddImportForRange(schemaId: string, rangeName: string): string | null;
}

// ── Helper: produce updated schema immutably ────────────────────────────────
type SchemaUpdater = (schema: LinkMLSchema) => LinkMLSchema;

function patchSchema(
  project: Project,
  schemaId: string,
  updater: SchemaUpdater
): Project {
  return {
    ...project,
    schemas: project.schemas.map((s) =>
      s.id === schemaId
        ? { ...s, schema: updater(s.schema), isDirty: true }
        : s
    ),
  };
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

    // Track in recent projects list
    addRecentProject({
      id: project.id,
      name: project.name,
      rootPath: project.rootPath,
      lastOpened: new Date().toISOString(),
      source: project.gitConfig?.enabled ? 'git' : 'local',
    });
  },

  closeProject() {
    const wasDirty = get().getIsDirty();
    set({ activeProject: null, activeSchemaId: null });
    return wasDirty;
  },

  setActiveSchema(schemaId) {
    set({ activeSchemaId: schemaId });
  },

  updateSchema(schemaId, partial) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => ({
          ...s,
          ...partial,
        })),
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

  // ── Class mutations ──────────────────────────────────────────────────────────

  addClass(schemaId, classDef) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => ({
          ...s,
          classes: { ...s.classes, [classDef.name]: classDef },
        })),
      };
    });
  },

  updateClass(schemaId, className, partial) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          const existing = s.classes[className];
          if (!existing) return s;
          return {
            ...s,
            classes: {
              ...s.classes,
              [className]: { ...existing, ...partial },
            },
          };
        }),
      };
    });
  },

  deleteClass(schemaId, className) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          const { [className]: _removed, ...rest } = s.classes;
          return { ...s, classes: rest };
        }),
      };
    });
  },

  renameClass(schemaId, oldName, newName) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          if (!s.classes[oldName] || s.classes[newName]) return s;
          const { [oldName]: classDef, ...rest } = s.classes;
          // Update references in other classes
          const updatedClasses: typeof s.classes = { ...rest, [newName]: { ...classDef, name: newName } };
          for (const [name, cls] of Object.entries(updatedClasses)) {
            let changed = false;
            let updated = { ...cls };
            if (cls.isA === oldName) { updated = { ...updated, isA: newName }; changed = true; }
            if (cls.mixins.includes(oldName)) { updated = { ...updated, mixins: cls.mixins.map((m) => m === oldName ? newName : m) }; changed = true; }
            if (changed) updatedClasses[name] = updated;
          }
          return { ...s, classes: updatedClasses };
        }),
      };
    });
  },

  // ── Slot / attribute mutations ───────────────────────────────────────────────

  addAttribute(schemaId, className, slot) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          const cls = s.classes[className];
          if (!cls) return s;
          return {
            ...s,
            classes: {
              ...s.classes,
              [className]: {
                ...cls,
                attributes: { ...cls.attributes, [slot.name]: slot },
              },
            },
          };
        }),
      };
    });
  },

  updateAttribute(schemaId, className, slotName, partial) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          const cls = s.classes[className];
          if (!cls) return s;
          const existing = cls.attributes[slotName];
          if (!existing) return s;
          return {
            ...s,
            classes: {
              ...s.classes,
              [className]: {
                ...cls,
                attributes: {
                  ...cls.attributes,
                  [slotName]: { ...existing, ...partial },
                },
              },
            },
          };
        }),
      };
    });
  },

  deleteAttribute(schemaId, className, slotName) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          const cls = s.classes[className];
          if (!cls) return s;
          const { [slotName]: _removed, ...rest } = cls.attributes;
          return {
            ...s,
            classes: {
              ...s.classes,
              [className]: { ...cls, attributes: rest },
            },
          };
        }),
      };
    });
  },

  renameAttribute(schemaId, className, oldName, newName) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          const cls = s.classes[className];
          if (!cls || !cls.attributes[oldName] || cls.attributes[newName]) return s;
          const { [oldName]: slot, ...rest } = cls.attributes;
          return {
            ...s,
            classes: {
              ...s.classes,
              [className]: {
                ...cls,
                attributes: { ...rest, [newName]: { ...slot, name: newName } },
              },
            },
          };
        }),
      };
    });
  },

  // ── Enum mutations ───────────────────────────────────────────────────────────

  addEnum(schemaId, enumDef) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => ({
          ...s,
          enums: { ...s.enums, [enumDef.name]: enumDef },
        })),
      };
    });
  },

  updateEnum(schemaId, enumName, partial) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          const existing = s.enums[enumName];
          if (!existing) return s;
          return {
            ...s,
            enums: { ...s.enums, [enumName]: { ...existing, ...partial } },
          };
        }),
      };
    });
  },

  deleteEnum(schemaId, enumName) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          const { [enumName]: _removed, ...rest } = s.enums;
          return { ...s, enums: rest };
        }),
      };
    });
  },

  renameEnum(schemaId, oldName, newName) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          if (!s.enums[oldName] || s.enums[newName]) return s;
          const { [oldName]: enumDef, ...rest } = s.enums;
          return {
            ...s,
            enums: { ...rest, [newName]: { ...enumDef, name: newName } },
          };
        }),
      };
    });
  },

  addPermissibleValue(schemaId, enumName, value) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          const enumDef = s.enums[enumName];
          if (!enumDef) return s;
          return {
            ...s,
            enums: {
              ...s.enums,
              [enumName]: {
                ...enumDef,
                permissibleValues: { ...enumDef.permissibleValues, [value.text]: value },
              },
            },
          };
        }),
      };
    });
  },

  updatePermissibleValue(schemaId, enumName, valueText, partial) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          const enumDef = s.enums[enumName];
          if (!enumDef) return s;
          const existing = enumDef.permissibleValues[valueText];
          if (!existing) return s;
          return {
            ...s,
            enums: {
              ...s.enums,
              [enumName]: {
                ...enumDef,
                permissibleValues: {
                  ...enumDef.permissibleValues,
                  [valueText]: { ...existing, ...partial },
                },
              },
            },
          };
        }),
      };
    });
  },

  deletePermissibleValue(schemaId, enumName, valueText) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          const enumDef = s.enums[enumName];
          if (!enumDef) return s;
          const { [valueText]: _removed, ...rest } = enumDef.permissibleValues;
          return {
            ...s,
            enums: {
              ...s.enums,
              [enumName]: { ...enumDef, permissibleValues: rest },
            },
          };
        }),
      };
    });
  },

  // ── Import management ────────────────────────────────────────────────────────

  addImport(schemaId, importPath) {
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          if (s.imports.includes(importPath)) return s;
          return { ...s, imports: [...s.imports, importPath] };
        }),
      };
    });
  },

  removeImportIfUnused(schemaId, importPath) {
    const { activeProject } = get();
    if (!activeProject) return false;

    const sf = activeProject.schemas.find((s) => s.id === schemaId);
    if (!sf) return false;

    // Resolve the import to a file path
    const resolvedPath = resolveImportPath(importPath, sf.filePath, '');

    // Find all schema files reachable via this import
    const importedSchema = activeProject.schemas.find((s) => s.filePath === resolvedPath);
    if (!importedSchema) {
      // Just remove the import string — we can't verify usage
      set((state) => {
        if (!state.activeProject) return state;
        return {
          activeProject: patchSchema(state.activeProject, schemaId, (s) => ({
            ...s,
            imports: s.imports.filter((imp) => imp !== importPath),
          })),
        };
      });
      return true;
    }

    const importedNames = new Set([
      ...Object.keys(importedSchema.schema.classes),
      ...Object.keys(importedSchema.schema.enums),
    ]);

    // Check if any attribute range in the active schema references an imported entity
    const schema = sf.schema;
    let stillUsed = false;
    for (const cls of Object.values(schema.classes)) {
      for (const slot of Object.values(cls.attributes)) {
        if (slot.range && importedNames.has(slot.range)) {
          stillUsed = true;
          break;
        }
      }
      if (stillUsed) break;
    }

    if (!stillUsed) {
      set((state) => {
        if (!state.activeProject) return state;
        return {
          activeProject: patchSchema(state.activeProject, schemaId, (s) => ({
            ...s,
            imports: s.imports.filter((imp) => imp !== importPath),
          })),
        };
      });
      return true;
    }
    return false;
  },

  autoAddImportForRange(schemaId, rangeName) {
    const { activeProject } = get();
    if (!activeProject) return null;

    const sf = activeProject.schemas.find((s) => s.id === schemaId);
    if (!sf) return null;

    const missingImport = findMissingImport(rangeName, sf, activeProject.schemas);
    if (!missingImport) return null;

    // Add the import
    set((state) => {
      if (!state.activeProject) return state;
      return {
        activeProject: patchSchema(state.activeProject, schemaId, (s) => {
          if (s.imports.includes(missingImport)) return s;
          return { ...s, imports: [...s.imports, missingImport] };
        }),
      };
    });

    return missingImport;
  },
});
