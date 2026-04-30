/**
 * E2E: Load personinfo.yaml fixture → modify class description → save →
 *       reopen from OPFS → assert change persisted.
 *
 * AC-T10 §6.7 journey 2
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

declare global {
  interface Window {
    __lme_e2e__: {
      loadSchema(yaml: string, opts?: { filePath?: string; rootPath?: string }): void;
      writeFile(path: string, content: string): Promise<void>;
      openProjectFromPath(dirPath: string): Promise<void>;
      setActiveEntity(entity: { type: 'class'; className: string }): void;
    };
  }
}

const FIXTURE_DIR = path.resolve(
  __dirname,
  '../../core/src/io/__fixtures__/schemas',
);
const OPFS_DIR = '/e2e-open-edit';
const FILE_NAME = 'personinfo.yaml';

async function waitForHelper(page: Page) {
  await page.waitForFunction(() => !!(window as Window).__lme_e2e__, { timeout: 15_000 });
}

test('open personinfo, edit description, save, reopen, assert persisted', async ({ page }) => {
  await page.goto('/');
  await waitForHelper(page);

  const personinfoYaml = fs.readFileSync(
    path.join(FIXTURE_DIR, FILE_NAME),
    'utf8',
  );

  // ── 1. Seed OPFS with personinfo.yaml ─────────────────────────────────────
  await page.evaluate(
    async ({ dir, name, content }) => {
      await window.__lme_e2e__.writeFile(`${dir}/${name}`, content);
    },
    { dir: OPFS_DIR, name: FILE_NAME, content: personinfoYaml },
  );

  // ── 2. Open the project from OPFS ─────────────────────────────────────────
  await page.evaluate(
    async (dir) => window.__lme_e2e__.openProjectFromPath(dir),
    OPFS_DIR,
  );
  await expect(page.locator('#lme-canvas-wrapper')).toBeVisible({ timeout: 10_000 });

  // ── 3. Select Person class and modify description ─────────────────────────
  await page.evaluate(() =>
    window.__lme_e2e__.setActiveEntity({ type: 'class', className: 'Person' }),
  );
  await expect(page.locator('#lme-properties-panel')).toBeVisible({ timeout: 5_000 });

  const descTextarea = page.getByPlaceholder('Optional description…');
  await descTextarea.clear();
  await descTextarea.fill('E2E edited description');

  // ── 4. Save with Ctrl+S ────────────────────────────────────────────────────
  await page.keyboard.press('Control+s');
  await expect(page.getByText(/Saved/)).toBeVisible({ timeout: 8_000 });

  // ── 5. Reopen the project from OPFS (simulates reopening) ─────────────────
  await page.evaluate(
    async (dir) => window.__lme_e2e__.openProjectFromPath(dir),
    OPFS_DIR,
  );
  await expect(page.locator('#lme-canvas-wrapper')).toBeVisible({ timeout: 8_000 });

  // ── 6. Select Person again and assert description change persisted ─────────
  await page.evaluate(() =>
    window.__lme_e2e__.setActiveEntity({ type: 'class', className: 'Person' }),
  );
  await expect(page.locator('#lme-properties-panel')).toBeVisible({ timeout: 5_000 });

  const updatedDesc = page.getByPlaceholder('Optional description…');
  await expect(updatedDesc).toHaveValue('E2E edited description', { timeout: 5_000 });
});
