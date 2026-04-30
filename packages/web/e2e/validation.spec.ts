/**
 * E2E: Create class with is_a pointing to non-existent parent →
 *       assert error badge in Validation panel and Properties panel shows
 *       the invalid reference.
 *
 * AC-T10 §6.7 journey 4
 */
import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __lme_e2e__: {
      loadSchema(yaml: string, opts?: { filePath?: string; rootPath?: string }): void;
      runValidation(): void;
      getValidationIssues(): Array<{ severity: string; message: string; path: string }>;
      setActiveEntity(entity: { type: 'class'; className: string }): void;
    };
  }
}

// Minimal schema where ChildClass.is_a references a non-existent parent.
const INVALID_ISA_YAML = `
id: https://example.org/invalid-isa
name: invalid_isa
default_prefix: ex
prefixes:
  ex: https://example.org/

classes:
  ChildClass:
    description: References a parent that does not exist
    is_a: NonExistentParent
`.trim();

async function waitForHelper(page: Page) {
  await page.waitForFunction(() => !!(window as Window).__lme_e2e__, { timeout: 15_000 });
}

test('invalid is_a: error badge in Validation panel, Properties panel shows ref', async ({ page }) => {
  await page.goto('/');
  await waitForHelper(page);

  // ── 1. Inject schema with invalid is_a directly into store ────────────────
  await page.evaluate(
    (yaml) => window.__lme_e2e__.loadSchema(yaml),
    INVALID_ISA_YAML,
  );
  await expect(page.locator('#lme-canvas-wrapper')).toBeVisible({ timeout: 10_000 });

  // ── 2. Open Validation panel by clicking the collapsed bar ────────────────
  const validationBar = page.locator('#lme-validation-panel');
  await expect(validationBar).toBeVisible({ timeout: 5_000 });
  await validationBar.click();

  // ── 3. Run validation ─────────────────────────────────────────────────────
  await page.getByTitle('Run validation').click();

  // ── 4. Assert error badge appears in Validation panel ─────────────────────
  // SummaryBar renders a span like "1 error" or "2 errors". Use .first() to
  // avoid strict-mode violation (the panel contains multiple elements with
  // "error" in text, e.g. the notice div and filter button).
  await expect(
    page.locator('#lme-validation-panel').getByText(/\d+ error/).first(),
  ).toBeVisible({ timeout: 5_000 });

  // ── 5. Verify via store that the is_a existence error is present ──────────
  const issues = await page.evaluate(() => window.__lme_e2e__.getValidationIssues());
  const isaError = issues.find(
    (i) => i.severity === 'error' && i.path.includes('is_a'),
  );
  expect(isaError).toBeDefined();
  expect(isaError!.message).toContain('NonExistentParent');

  // ── 6. Properties panel: select ChildClass and verify is_a value ──────────
  await page.evaluate(() =>
    window.__lme_e2e__.setActiveEntity({ type: 'class', className: 'ChildClass' }),
  );
  await expect(page.locator('#lme-properties-panel')).toBeVisible({ timeout: 5_000 });

  // The is_a FilteredGroupedSelect input uses placeholder "(none)".
  // When a value is set, the input shows it as the field value.
  const isAInput = page.locator('#lme-properties-panel').getByPlaceholder('(none)');
  await expect(isAInput).toHaveValue('NonExistentParent', { timeout: 3_000 });

  // The canvas node also shows "is_a: NonExistentParent" in the body.
  await expect(page.getByText('NonExistentParent').first()).toBeVisible({ timeout: 3_000 });
});
