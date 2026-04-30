/**
 * E2E: New project → add class → add slot → save → assert YAML on disk
 *
 * AC-T10 §6.7 journey 1
 */
import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __lme_e2e__: {
      setRootPath(path: string): void;
      getActiveYaml(): string;
      readFile(path: string): Promise<string>;
    };
  }
}

// Single-level path so LightningFS mkdir works without multi-level creation.
const OPFS_ROOT = '/e2e-new-project';

async function waitForHelper(page: Page) {
  await page.waitForFunction(() => !!(window as Window).__lme_e2e__, { timeout: 15_000 });
}

test('new project: add class + slot, save, assert YAML on disk', async ({ page }) => {
  await page.goto('/');
  await waitForHelper(page);

  // ── 1. Create new project via splash page ──────────────────────────────────
  await page.getByText('New Empty Project').click();
  await expect(page.locator('#lme-canvas-wrapper')).toBeVisible({ timeout: 10_000 });

  // Set a known rootPath so Ctrl+S writes to OPFS without a directory-picker dialog.
  await page.evaluate((root) => window.__lme_e2e__.setRootPath(root), OPFS_ROOT);

  // ── 2. Add a class via the canvas toolbar ──────────────────────────────────
  await page.locator('#lme-canvas-add-class').click();

  // handleAddClass auto-selects the new node; the Properties panel opens automatically.
  await expect(page.locator('#lme-properties-panel')).toBeVisible({ timeout: 8_000 });

  // ── 3. Add an attribute via the "new attribute name…" input ───────────────
  const slotInput = page.locator('#lme-properties-panel').getByPlaceholder('new attribute name…');
  await expect(slotInput).toBeVisible({ timeout: 5_000 });
  await slotInput.fill('my_slot');
  await slotInput.press('Enter');

  // ── 4. Save with Ctrl+S ────────────────────────────────────────────────────
  // Click elsewhere first to ensure the window has focus for the shortcut.
  await page.locator('#lme-canvas-wrapper').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+s');

  // Wait for the "Saved" success toast.
  await expect(page.getByText(/Saved \d+ file/)).toBeVisible({ timeout: 10_000 });

  // ── 5. Assert the YAML written to OPFS contains class + slot ──────────────
  const yaml = await page.evaluate(
    (root) => window.__lme_e2e__.readFile(`${root}/untitled_schema.yaml`),
    OPFS_ROOT,
  );

  expect(yaml).toContain('NewClass:');
  expect(yaml).toContain('my_slot:');
});
