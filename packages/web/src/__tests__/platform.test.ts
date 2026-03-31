/**
 * Web platform smoke tests.
 *
 * Tests run in jsdom so FSAA is unavailable; we validate the fallback paths
 * and basic platform contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── LightningFS mock ──────────────────────────────────────────────────────────
// isomorphic-git and LightningFS use IndexedDB / OPFS internally.
// In jsdom neither is available so we mock the module.
vi.mock('@isomorphic-git/lightning-fs', () => {
  const mockPfs = {
    readFile: vi.fn().mockResolvedValue('content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    stat: vi.fn().mockResolvedValue({ isDirectory: () => false }),
  };
  return {
    default: vi.fn(() => ({ promises: mockPfs })),
  };
});

vi.mock('isomorphic-git', () => ({
  default: {
    resolveRef: vi.fn().mockRejectedValue(new Error('not a git repo')),
    currentBranch: vi.fn().mockResolvedValue('main'),
    statusMatrix: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue('abc1234'),
    push: vi.fn().mockResolvedValue({}),
    log: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('isomorphic-git/http/web', () => ({ default: {} }));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WebPlatform', () => {
  let platform: Awaited<ReturnType<typeof import('../platform/WebPlatform.js').WebPlatform.prototype.init>> extends void ? InstanceType<typeof import('../platform/WebPlatform.js').WebPlatform> : never;

  beforeEach(async () => {
    const { WebPlatform } = await import('../platform/WebPlatform.js');
    platform = new WebPlatform() as typeof platform;
  });

  it('has platform = "web"', async () => {
    const { WebPlatform } = await import('../platform/WebPlatform.js');
    const p = new WebPlatform();
    expect(p.platform).toBe('web');
  });

  it('gitAvailable is false by default', async () => {
    const { WebPlatform } = await import('../platform/WebPlatform.js');
    const p = new WebPlatform();
    expect(p.gitAvailable).toBe(false);
  });

  it('init() sets gitAvailable based on git.resolveRef', async () => {
    const { WebPlatform } = await import('../platform/WebPlatform.js');
    const p = new WebPlatform();
    // resolveRef is mocked to throw → gitAvailable stays false
    await p.init('/some/repo');
    expect(p.gitAvailable).toBe(false);
  });

  it('listDirectory returns empty array when dir is empty', async () => {
    const { WebPlatform } = await import('../platform/WebPlatform.js');
    const p = new WebPlatform();
    const result = await p.listDirectory('/');
    expect(Array.isArray(result)).toBe(true);
  });

  it('gitLog returns empty array when git unavailable', async () => {
    const { WebPlatform } = await import('../platform/WebPlatform.js');
    const p = new WebPlatform();
    const log = await p.gitLog('/repo', 10);
    expect(log).toEqual([]);
  });

  it('gitStatus returns null when git unavailable', async () => {
    const { WebPlatform } = await import('../platform/WebPlatform.js');
    const p = new WebPlatform();
    const status = await p.gitStatus('/repo');
    expect(status).toBeNull();
  });
});

describe('ElectronPlatform', () => {
  it('has platform = "electron"', async () => {
    // Provide a mock window.electronAPI so ElectronPlatform can instantiate
    (globalThis as unknown as Record<string, unknown>).window = {
      electronAPI: {
        openFile: vi.fn(),
        saveFile: vi.fn(),
        openDirectory: vi.fn(),
        readFile: vi.fn().mockResolvedValue(''),
        writeFile: vi.fn(),
        listDirectory: vi.fn().mockResolvedValue([]),
        gitAvailable: vi.fn().mockResolvedValue(false),
        gitStatus: vi.fn().mockResolvedValue(null),
        gitStage: vi.fn(),
        gitCommit: vi.fn().mockResolvedValue(null),
        gitPush: vi.fn().mockResolvedValue({ ok: true }),
        gitLog: vi.fn().mockResolvedValue([]),
      },
    };

    const { ElectronPlatform } = await import('../platform/ElectronPlatform.js');
    const p = new ElectronPlatform();
    expect(p.platform).toBe('electron');
  });
});
