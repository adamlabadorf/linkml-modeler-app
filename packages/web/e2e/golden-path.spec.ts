/**
 * E2E: Golden-path adoption scenario — the end-to-end journey a new user
 * follows to create, edit, connect, validate, inspect, save, and reload a
 * schema.
 *
 * Steps (matching PTS-124 acceptance criteria):
 *  1. Open app, load demo schema (one pre-existing class)
 *  2. Add a new class via the canvas toolbar
 *  3. Wire up is_a inheritance to the pre-existing class
 *  4. Add an attribute to the new class via the Properties panel
 *  5. Run validation — assert zero errors
 *  6. Inspect the YAML preview panel; verify both classes and inheritance appear
 *  7. Save to OPFS via Ctrl+S
 *  8. Reload the project from OPFS
 *  9. Confirm the new class, attribute, and inheritance survive the round-trip
 *
 * AC-T10 §6.7 journey 6 (PTS-124)
 */
import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __lme_e2e__: {
      loadSchema(yaml: string, opts?: { filePath?: string; rootPath?: string }): void;
      getActiveYaml(): string;
      runValidation(): void;
      getValidationIssues(): Array<{ severity: string; message: string; path: string }>;
      openProjectFromPath(dirPath: string): Promise<void>;
    };
  }
}

// Base schema: one pre-existing class for the new class to inherit from.
// Includes all required metadata so validation starts at zero errors.
const BASE_SCHEMA_YAML = `
id: https://example.org/golden-path
name: golden_path
default_prefix: ex
prefixes:
  ex: https://example.org/

classes:
  BaseClass:
    description: Base class for inheritance tests
`.trim();

const OPFS_ROOT = '/e2e-golden-path';

async function waitForHelper(page: Page) {
  await page.waitForFunction(() => !!(window as Window).__lme_e2e__, { timeout: 15_000 });
}

test('golden path: add class, set inheritance, add slot, validate, YAML preview, save, reload', async ({ page }) => {
  await page.goto('/');
  await waitForHelper(page);

  // ── 1. Load base schema (pre-existing class + valid metadata) ─────────────
  // rootPath is set here so Ctrl+S later writes to OPFS without a dialog.
  await page.evaluate(
    ({ yaml, root }) =>
      window.__lme_e2e__.loadSchema(yaml, { rootPath: root, filePath: 'schema.yaml' }),
    { yaml: BASE_SCHEMA_YAML, root: OPFS_ROOT },
  );
  await expect(page.locator('#lme-canvas-wrapper')).toBeVisible({ timeout: 10_000 });

  // ── 2. Add a new class via the canvas toolbar ─────────────────────────────
  // handleAddClass auto-selects the new node → Properties panel opens.
  await page.locator('#lme-canvas-add-class').click();
  await expect(page.locator('#lme-properties-panel')).toBeVisible({ timeout: 8_000 });

  // ── 3. Set is_a → BaseClass before adding any slots ──────────────────────
  // At this point the only FilteredGroupedSelect with placeholder "(none)" in
  // the panel is the is_a field (no slot range fields rendered yet).
  const isAInput = page.locator('#lme-properties-panel').getByPlaceholder('(none)');
  await isAInput.click();
  await isAInput.fill('BaseClass');
  await isAInput.press('Enter');

  // ── 4. Add an attribute to the new class ──────────────────────────────────
  const slotInput = page.locator('#lme-properties-panel').getByPlaceholder('new attribute name…');
  await expect(slotInput).toBeVisible({ timeout: 5_000 });
  await slotInput.fill('my_attr');
  await slotInput.press('Enter');

  // ── 5. Run validation — expect zero errors ────────────────────────────────
  // Warnings/infos are acceptable (e.g. missing description); errors are not.
  await page.evaluate(() => window.__lme_e2e__.runValidation());
  const issues = await page.evaluate(() => window.__lme_e2e__.getValidationIssues());
  const errors = issues.filter((i: { severity: string }) => i.severity === 'error');
  expect(errors).toHaveLength(0);

  // ── 6. Inspect YAML preview panel ────────────────────────────────────────
  // yamlPreviewOpen defaults to true in the store, so the panel is visible.
  const previewPanel = page.locator('#lme-yaml-preview');
  await expect(previewPanel).toBeVisible({ timeout: 5_000 });
  await expect(previewPanel.locator('pre')).toContainText('BaseClass:');
  await expect(previewPanel.locator('pre')).toContainText('NewClass:');
  await expect(previewPanel.locator('pre')).toContainText('is_a: BaseClass');
  await expect(previewPanel.locator('pre')).toContainText('my_attr:');

  // ── 7. Save via Ctrl+S ────────────────────────────────────────────────────
  // Click canvas first to ensure the window has keyboard focus for the shortcut.
  await page.locator('#lme-canvas-wrapper').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+s');
  await expect(page.getByText(/Saved \d+ file/)).toBeVisible({ timeout: 10_000 });

  // ── 8. Reload the project from OPFS ──────────────────────────────────────
  await page.evaluate(
    (dir) => window.__lme_e2e__.openProjectFromPath(dir),
    OPFS_ROOT,
  );
  await expect(page.locator('#lme-canvas-wrapper')).toBeVisible({ timeout: 10_000 });

  // ── 9. Confirm model is preserved after reload ────────────────────────────
  const reloadedYaml = await page.evaluate(() => window.__lme_e2e__.getActiveYaml());
  expect(reloadedYaml).toContain('BaseClass:');
  expect(reloadedYaml).toContain('NewClass:');
  expect(reloadedYaml).toContain('is_a: BaseClass');
  expect(reloadedYaml).toContain('my_attr:');
});
