import { describe, it, expect } from 'vitest';
import { isAllowedExternalUrl, isPathWithinAllowedRoots } from './security.js';

describe('isAllowedExternalUrl', () => {
  it.each([
    ['https://github.com/linkml/linkml', true],
    ['https://example.com', true],
    ['http://localhost:5173', true],
    ['http://example.com/path?q=1', true],
    ['mailto:user@example.com', true],
    ['file:///etc/passwd', false],
    ['file://C:/Windows/System32', false],
    ['javascript:alert(1)', false],
    ['app://index.html', false],
    ['ftp://example.com', false],
    ['data:text/html,<h1>x</h1>', false],
    ['vbscript:msgbox(1)', false],
    ['not-a-url', false],
    ['', false],
  ])('isAllowedExternalUrl(%s) === %s', (url, expected) => {
    expect(isAllowedExternalUrl(url)).toBe(expected);
  });
});

describe('isPathWithinAllowedRoots', () => {
  const root = '/home/user/projects/my-schema';

  it('allows a file directly inside the root', () => {
    expect(
      isPathWithinAllowedRoots(`${root}/schema.yaml`, new Set([root]))
    ).toBe(true);
  });

  it('allows a deeply nested file inside the root', () => {
    expect(
      isPathWithinAllowedRoots(`${root}/sub/nested/file.yaml`, new Set([root]))
    ).toBe(true);
  });

  it('allows the root directory itself', () => {
    expect(isPathWithinAllowedRoots(root, new Set([root]))).toBe(true);
  });

  it('rejects a file outside the root', () => {
    expect(
      isPathWithinAllowedRoots('/home/user/other/evil.yaml', new Set([root]))
    ).toBe(false);
  });

  it('rejects a system path when no roots are registered', () => {
    expect(isPathWithinAllowedRoots('/etc/passwd', new Set())).toBe(false);
  });

  it('rejects path traversal via .. segments', () => {
    // Attacker constructs a path that looks inside root but resolves outside
    expect(
      isPathWithinAllowedRoots(`${root}/../../evil.yaml`, new Set([root]))
    ).toBe(false);
  });

  it('rejects absolute path traversal via many .. segments', () => {
    expect(
      isPathWithinAllowedRoots(`${root}/../../../../../etc/passwd`, new Set([root]))
    ).toBe(false);
  });

  it('rejects a sibling directory that shares a name prefix', () => {
    // /my-schema2 must not be considered inside /my-schema
    expect(
      isPathWithinAllowedRoots('/home/user/projects/my-schema2/file.yaml', new Set([root]))
    ).toBe(false);
  });

  it('allows a path matching any root in a multi-root set', () => {
    const roots = new Set(['/home/user/projects/a', '/home/user/projects/b']);
    expect(isPathWithinAllowedRoots('/home/user/projects/a/file.yaml', roots)).toBe(true);
    expect(isPathWithinAllowedRoots('/home/user/projects/b/deep/file.yaml', roots)).toBe(true);
    expect(isPathWithinAllowedRoots('/home/user/projects/c/file.yaml', roots)).toBe(false);
  });

  it('allows a clone destination inside Documents (startup-seeded root)', () => {
    const docs = '/home/user/Documents';
    expect(
      isPathWithinAllowedRoots('/home/user/Documents/LinkMLProjects/my-repo', new Set([docs]))
    ).toBe(true);
  });

  it('allows a path with redundant . segments', () => {
    expect(
      isPathWithinAllowedRoots(`${root}/./sub/../sub/file.yaml`, new Set([root]))
    ).toBe(true);
  });
});
