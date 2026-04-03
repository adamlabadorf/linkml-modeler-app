// localStorage adapter for recent projects list
// Persists a capped, sorted list of recently opened projects.

import type { RecentProject } from '../model/index.js';

const STORAGE_KEY = 'linkml-editor-recent-projects';
const MAX_RECENT = 20;

export function getRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentProject[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
    );
  } catch {
    return [];
  }
}

export function addRecentProject(project: RecentProject): void {
  const existing = getRecentProjects();
  // Remove duplicate by rootPath (same directory = same project)
  const filtered = existing.filter((p) => p.rootPath !== project.rootPath);
  const updated = [{ ...project, lastOpened: new Date().toISOString() }, ...filtered].slice(
    0,
    MAX_RECENT
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function removeRecentProject(rootPath: string): void {
  const existing = getRecentProjects();
  const updated = existing.filter((p) => p.rootPath !== rootPath);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearRecentProjects(): void {
  localStorage.removeItem(STORAGE_KEY);
}
