/**
 * Unit tests for GitHubAuth — mocks fetch to avoid real network calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@isomorphic-git/lightning-fs', () => ({
  default: vi.fn(() => ({ promises: {} })),
}));
vi.mock('isomorphic-git', () => ({ default: {} }));
vi.mock('isomorphic-git/http/web', () => ({ default: {} }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockPlatform() {
  const store = new Map<string, string>();
  return {
    platform: 'web' as const,
    gitAvailable: false,
    storeCredential: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
    getCredential: vi.fn(async (k: string) => store.get(k) ?? null),
    deleteCredential: vi.fn(async (k: string) => { store.delete(k); }),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    openFile: vi.fn(),
    saveFile: vi.fn(),
    openDirectory: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    listDirectory: vi.fn(),
    initGit: vi.fn(async () => false),
    gitCreateRepo: vi.fn(async () => false),
    gitSetRemote: vi.fn(async () => {}),
    gitReadConfig: vi.fn(async () => ({})),
    getProjectsPath: vi.fn(async () => '/projects'),
    gitStatus: vi.fn(),
    gitStage: vi.fn(),
    gitCommit: vi.fn(),
    gitPush: vi.fn(),
    gitPull: vi.fn(),
    gitLog: vi.fn(),
    gitCheckout: vi.fn(),
    gitClone: vi.fn(),
  };
}

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => response,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GitHubAuth', () => {
  let GitHubAuth: typeof import('../../../core/src/auth/GitHubAuth.js').GitHubAuth;

  beforeEach(async () => {
    ({ GitHubAuth } = await import('../../../core/src/auth/GitHubAuth.js'));
  });

  it('getSession returns null when no credential stored', async () => {
    const platform = makeMockPlatform();
    const auth = new GitHubAuth(platform, 'test-client-id');
    const session = await auth.getSession();
    expect(session).toBeNull();
  });

  it('getSession returns session when token is valid', async () => {
    const platform = makeMockPlatform();
    await platform.storeCredential('github-token', 'valid-token');

    const globalFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ login: 'testuser', name: 'Test User', avatar_url: 'https://example.com/avatar.png' }),
    });
    vi.stubGlobal('fetch', globalFetch);

    const auth = new GitHubAuth(platform, 'test-client-id');
    const session = await auth.getSession();

    expect(session).not.toBeNull();
    expect(session?.login).toBe('testuser');
    expect(session?.token).toBe('valid-token');

    vi.unstubAllGlobals();
  });

  it('getSession clears credential and returns null when token is invalid', async () => {
    const platform = makeMockPlatform();
    await platform.storeCredential('github-token', 'bad-token');

    vi.stubGlobal('fetch', mockFetch({}, 401));

    const auth = new GitHubAuth(platform, 'test-client-id');
    const session = await auth.getSession();

    expect(session).toBeNull();
    expect(await platform.getCredential('github-token')).toBeNull();

    vi.unstubAllGlobals();
  });

  it('startDeviceFlow returns handle with userCode and verificationUri', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        device_code: 'device-abc',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      }),
    }));

    const platform = makeMockPlatform();
    const auth = new GitHubAuth(platform, 'test-client-id');
    const handle = await auth.startDeviceFlow();

    expect(handle.userCode).toBe('ABCD-1234');
    expect(handle.verificationUri).toBe('https://github.com/login/device');

    vi.unstubAllGlobals();
  });

  it('poll resolves with session after access_token received', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('device/code')) {
        return {
          ok: true,
          json: async () => ({
            device_code: 'device-abc',
            user_code: 'ABCD-1234',
            verification_uri: 'https://github.com/login/device',
            expires_in: 900,
            interval: 0, // 0ms for test speed
          }),
        };
      }
      if (url.includes('access_token')) {
        callCount++;
        if (callCount < 2) {
          return { ok: true, json: async () => ({ error: 'authorization_pending' }) };
        }
        return { ok: true, json: async () => ({ access_token: 'tok123' }) };
      }
      // user API
      return {
        ok: true,
        json: async () => ({ login: 'devuser', name: null, avatar_url: 'https://example.com/av.png' }),
      };
    }));

    const platform = makeMockPlatform();
    const auth = new GitHubAuth(platform, 'test-client-id');
    const handle = await auth.startDeviceFlow();
    const session = await handle.poll();

    expect(session.login).toBe('devuser');
    expect(session.token).toBe('tok123');
    expect(await platform.getCredential('github-token')).toBe('tok123');

    vi.unstubAllGlobals();
  });

  it('cancel() causes poll to reject with cancellation error', async () => {
    // Use a short interval so the test doesn't hang
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        device_code: 'device-abc',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 0, // 0ms between polls so test is fast
      }),
    }));

    const platform = makeMockPlatform();
    const auth = new GitHubAuth(platform, 'test-client-id');
    const handle = await auth.startDeviceFlow();

    // Cancel before poll() resolves
    handle.cancel();

    // poll() will call attempt() after setTimeout(0) and see cancelled = true
    await expect(handle.poll()).rejects.toThrow('Device flow cancelled');

    vi.unstubAllGlobals();
  }, 2000);

  it('poll rejects on access_denied', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('device/code')) {
        return {
          ok: true,
          json: async () => ({
            device_code: 'device-abc',
            user_code: 'ABCD-1234',
            verification_uri: 'https://github.com/login/device',
            expires_in: 900,
            interval: 0,
          }),
        };
      }
      return { ok: true, json: async () => ({ error: 'access_denied' }) };
    }));

    const platform = makeMockPlatform();
    const auth = new GitHubAuth(platform, 'test-client-id');
    const handle = await auth.startDeviceFlow();

    await expect(handle.poll()).rejects.toThrow('denied');

    vi.unstubAllGlobals();
  });
});
