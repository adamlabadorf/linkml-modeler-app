/**
 * ProjectRegistry — tracks GitHub-backed projects connected on this machine/browser.
 *
 * Web: stored in localStorage under 'linkml-editor-settings:project-registry'
 *
 * One entry per unique repoUrl. Updated on clone/create/convert/remove.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GitHubProjectConfig {
  repoUrl: string;        // e.g. "https://github.com/owner/repo"
  schemaPath: string;     // relative path to schema dir, e.g. "schema/" or "."
  persistLayout: boolean; // whether layout.json is committed to repo
}

export interface ProjectRegistryEntry {
  repoUrl: string;
  repoName: string;       // display name (last path segment)
  schemaPath: string;
  persistLayout: boolean;
  localPath: string;      // OPFS key (web) or abs path (Electron)
  lastOpenedAt: string;   // ISO timestamp
}

export interface ProjectRegistry {
  projects: ProjectRegistryEntry[];
}

// ── WebProjectRegistry ────────────────────────────────────────────────────────

const REGISTRY_KEY = 'linkml-editor-settings:project-registry';

export class WebProjectRegistry {
  load(): ProjectRegistry {
    try {
      const raw = localStorage.getItem(REGISTRY_KEY);
      if (!raw) return { projects: [] };
      return JSON.parse(raw) as ProjectRegistry;
    } catch {
      return { projects: [] };
    }
  }

  save(registry: ProjectRegistry): void {
    try {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch {
      // Storage quota exceeded — silently fail
    }
  }

  addOrUpdate(entry: ProjectRegistryEntry): void {
    const reg = this.load();
    const idx = reg.projects.findIndex((p) => p.repoUrl === entry.repoUrl);
    if (idx >= 0) {
      reg.projects[idx] = entry;
    } else {
      reg.projects.push(entry);
    }
    this.save(reg);
  }

  remove(repoUrl: string): void {
    const reg = this.load();
    reg.projects = reg.projects.filter((p) => p.repoUrl !== repoUrl);
    this.save(reg);
  }

  getAll(): ProjectRegistryEntry[] {
    return this.load().projects;
  }

  getByRepoUrl(repoUrl: string): ProjectRegistryEntry | null {
    return this.load().projects.find((p) => p.repoUrl === repoUrl) ?? null;
  }

  /** Derive OPFS clone path from repoUrl: /github-projects/{owner}/{repo} */
  static opfsPathForRepo(repoUrl: string): string {
    // e.g. https://github.com/owner/repo -> /github-projects/owner/repo
    try {
      const url = new URL(repoUrl);
      // pathname is /owner/repo
      const parts = url.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
      const owner = parts[0] ?? 'unknown';
      const repo = parts[1] ?? 'repo';
      return `/github-projects/${owner}/${repo}`;
    } catch {
      // Fallback: hash the URL
      return `/github-projects/${btoa(repoUrl).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`;
    }
  }

  /** Parse owner/repo from a GitHub URL */
  static parseOwnerRepo(repoUrl: string): { owner: string; repo: string } | null {
    try {
      const url = new URL(repoUrl);
      if (!url.hostname.includes('github.com')) return null;
      const parts = url.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
      if (parts.length < 2) return null;
      return { owner: parts[0], repo: parts[1] };
    } catch {
      return null;
    }
  }
}
