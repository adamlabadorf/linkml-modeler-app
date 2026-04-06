// Project loader — scans a directory for LinkML schemas and builds a Project object.

import type { PlatformAPI } from '../platform/PlatformContext.js';
import type { Project, SchemaFile } from '../model/index.js';
import { emptyCanvasLayout, emptySchema } from '../model/index.js';
import { parseYaml } from '../io/yaml.js';
import { resolveImports } from '../io/importResolver.js';

/**
 * Check if a YAML string looks like a LinkML schema by testing for
 * characteristic top-level fields (`id:` and `prefixes:` or `classes:`).
 */
function looksLikeLinkMLSchema(content: string): boolean {
  const hasId = /^id\s*:/m.test(content);
  const hasPrefixes = /^prefixes\s*:/m.test(content);
  const hasClasses = /^classes\s*:/m.test(content);
  return hasId && (hasPrefixes || hasClasses);
}

/**
 * Scan a directory for YAML/YML files that look like LinkML schemas,
 * parse them, and build a Project object.
 */
export async function openProjectFromDirectory(
  dirPath: string,
  platform: PlatformAPI
): Promise<Project> {
  const entries = await platform.listDirectory(dirPath);
  const yamlFiles = entries.filter(
    (e) => !e.isDirectory && /\.(ya?ml)$/i.test(e.name)
  );

  const schemaFiles: SchemaFile[] = [];

  for (const entry of yamlFiles) {
    try {
      const content = await platform.readFile(entry.path);
      if (!looksLikeLinkMLSchema(content)) continue;

      const schema = parseYaml(content);
      const relativePath = entry.name; // Top-level files — relative to rootPath

      schemaFiles.push({
        id: crypto.randomUUID(),
        filePath: relativePath,
        schema,
        isDirty: false,
        canvasLayout: emptyCanvasLayout(),
      });
    } catch {
      // Skip files that fail to parse — they may not be valid LinkML
      continue;
    }
  }

  // Resolve imports (local paths + URLs) for all loaded schemas
  const importedFiles = await resolveImports(schemaFiles, platform, dirPath);
  const allSchemas = [...schemaFiles, ...importedFiles];

  const dirName = dirPath.split('/').filter(Boolean).pop() ?? 'Untitled Project';

  return {
    id: crypto.randomUUID(),
    name: dirName,
    rootPath: dirPath,
    schemas: allSchemas,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create a new empty project with a single blank schema.
 */
export function createNewProject(name: string, rootPath: string = ''): Project {
  const schemaName = name.toLowerCase().replace(/\s+/g, '_');
  const schemaId = `https://example.org/${schemaName}`;

  const schema = emptySchema(schemaName, schemaId, schemaName);

  const schemaFile: SchemaFile = {
    id: crypto.randomUUID(),
    filePath: `${schemaName}.yaml`,
    schema,
    isDirty: false,
    canvasLayout: emptyCanvasLayout(),
  };

  return {
    id: crypto.randomUUID(),
    name,
    rootPath,
    schemas: [schemaFile],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
