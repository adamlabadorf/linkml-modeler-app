/**
 * Maps raw isomorphic-git error strings to user-friendly messages.
 */
export function friendlyGitError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('fetch')) {
    return 'Could not reach the repository. This may be a browser security restriction (CORS) — try the Electron desktop app for full git support.';
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return 'Repository not found. Check the URL is correct and the repo exists.';
  }
  if (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  ) {
    return 'Access denied. Check your credentials or make sure the repository is public.';
  }
  return msg;
}
