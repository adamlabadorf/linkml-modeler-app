// Public API for @linkml-editor/core
export * from './model/index.js';
export * from './store/index.js';
export * from './platform/PlatformContext.js';
export { StubWebPlatform } from './platform/StubWebPlatform.js';
export { parseYaml, serializeYaml, validateSchema } from './io/yaml.js';
export type { ValidationError } from './io/yaml.js';
export { parseManifest, serializeManifest, MANIFEST_FILENAME } from './io/manifest.js';
export {
  isLocalImport,
  resolveImportPath,
  resolveImports,
  buildDependencyGraph,
  collectImportedEntities,
  collectReferencedImportedEntities,
  findMissingImport,
} from './io/importResolver.js';
export type { SchemaDependency, ImportedEntity } from './io/importResolver.js';
export * from './canvas/index.js';
export * from './editor/index.js';
export * from './validation/index.js';
export { getRecentProjects, addRecentProject, removeRecentProject, clearRecentProjects } from './project/recentProjects.js';
export { openProjectFromDirectory, createNewProject } from './project/projectLoader.js';
