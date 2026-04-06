import { describe, it, expect } from 'vitest';
import { friendlyGitError } from '../platform/gitErrorMessages.js';

describe('friendlyGitError', () => {
  it('maps "failed to fetch" to a CORS hint', () => {
    const result = friendlyGitError('Failed to fetch');
    expect(result).toContain('CORS');
    expect(result).toContain('Electron desktop app');
  });

  it('maps "fetch" alone to a CORS hint', () => {
    const result = friendlyGitError('TypeError: fetch error');
    expect(result).toContain('CORS');
  });

  it('maps "404" to a not found message', () => {
    const result = friendlyGitError('HTTP 404: Not Found');
    expect(result).toContain('Repository not found');
    expect(result).toContain('URL is correct');
  });

  it('maps "not found" (without 404) to a not found message', () => {
    const result = friendlyGitError('remote: Repository not found.');
    expect(result).toContain('Repository not found');
  });

  it('maps "401" to an access denied message', () => {
    const result = friendlyGitError('HTTP 401: Unauthorized');
    expect(result).toContain('Access denied');
  });

  it('maps "403" to an access denied message', () => {
    const result = friendlyGitError('HTTP 403: Forbidden');
    expect(result).toContain('Access denied');
  });

  it('maps "unauthorized" (lowercase) to an access denied message', () => {
    const result = friendlyGitError('unauthorized');
    expect(result).toContain('Access denied');
  });

  it('maps "forbidden" to an access denied message', () => {
    const result = friendlyGitError('forbidden resource');
    expect(result).toContain('Access denied');
  });

  it('passes through unknown errors unchanged', () => {
    const msg = 'Some unexpected internal error from isomorphic-git';
    expect(friendlyGitError(msg)).toBe(msg);
  });
});
