/**
 * E2E: Load corpus schema → save without modification → assert no diff.
 *
 * Uses the mixins fixture (no external imports, multiple classes) to verify
 * that the editor's YAML serializer produces bit-for-bit identical output
 * compared to the in-memory representation without any schema mutation.
 *
 * AC-T10 §6.7 journey 3
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

declare global {
  interface Window {
    __lme_e2e__: {
      loadSchema(yaml: string, opts?: { filePath?: string; rootPath?: string; dirty?: boolean }): void;
      getActiveYaml(): string;
      readFile(path: string): Promise<string>;
    };
  }
}

const FIXTURE_DIR = path.resolve(
  __dirname,
  '../../core/src/io/__fixtures__/schemas',
);
const OPFS_ROOT = '/e2e-roundtrip';
const FILE_NAME = 'mixins.yaml';

async function waitForHelper(page: Page) {
  await page.waitForFunction(() => !!(window as Window).__lme_e2e__, { timeout: 15_000 });
}

test('round-trip: load corpus schema, save unmodified, assert no diff', async ({ page }) => {
  await page.goto('/');
  await waitForHelper(page);

  const originalYaml = fs.readFileSync(
    path.join(FIXTURE_DIR, FILE_NAME),
    'utf8',
  );

  // ── 1. Load schema directly into the store ─────────────────────────────────
  // dirty: true so that Ctrl+S proceeds past the "nothing to save" guard.
  await page.evaluate(
    ({ yaml, root, name }) =>
      window.__lme_e2e__.loadSchema(yaml, { filePath: name, rootPath: root, dirty: true }),
    { yaml: originalYaml, root: OPFS_ROOT, name: FILE_NAME },
  );
  await expect(page.locator('#lme-canvas-wrapper')).toBeVisible({ timeout: 10_000 });

  // ── 2. Capture in-memory YAML before saving ────────────────────────────────
  const preYaml = await page.evaluate(() => window.__lme_e2e__.getActiveYaml());

  // ── 3. Save with Ctrl+S (no edits — should write identical content) ────────
  await page.keyboard.press('Control+s');
  await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 8_000 });

  // ── 4. Read YAML back from OPFS ───────────────────────────────────────────
  const savedYaml = await page.evaluate(
    ([root, name]) => window.__lme_e2e__.readFile(`${root}/${name}`),
    [OPFS_ROOT, FILE_NAME] as [string, string],
  );

  // ── 5. Assert saved content equals pre-save serialization ─────────────────
  // Both must represent the same schema: the file on disk must match what
  // was held in memory (the normalised round-trip, not the raw fixture text).
  expect(savedYaml).toBe(preYaml);

  // Also verify the key classes are still present.
  expect(savedYaml).toContain('Timestamped:');
  expect(savedYaml).toContain('Audited:');
  expect(savedYaml).toContain('Record:');
});
