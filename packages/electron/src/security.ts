import path from 'path';

const ALLOWED_EXTERNAL_SCHEMES = new Set(['https:', 'http:', 'mailto:']);

/**
 * Returns true if the URL uses a safe scheme for shell.openExternal.
 * Blocks file://, javascript:, app://, data:, and other schemes that
 * could invoke unintended handlers or read local files.
 */
export function isAllowedExternalUrl(url: string): boolean {
  try {
    return ALLOWED_EXTERNAL_SCHEMES.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Returns true if filePath resolves to a location inside at least one
 * of the provided allowedRoots. Uses path.relative rather than startsWith
 * so that /foo/bar2 is correctly rejected as a child of /foo/bar.
 */
export function isPathWithinAllowedRoots(filePath: string, allowedRoots: Set<string>): boolean {
  const resolved = path.resolve(filePath);
  for (const root of allowedRoots) {
    const rel = path.relative(path.resolve(root), resolved);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      return true;
    }
  }
  return false;
}
