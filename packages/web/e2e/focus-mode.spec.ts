/**
 * E2E: Load multi-class schema → activate focus mode on selection →
 *       assert dimmed nodes are non-interactive (opacity 0.3, pointer-events none).
 *
 * AC-T10 §6.7 journey 5
 */
import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __lme_e2e__: {
      loadSchema(yaml: string, opts?: { filePath?: string; rootPath?: string }): void;
      setSelection(nodeIds: string[]): void;
    };
  }
}

// Three-class schema so we can focus one and assert the other two are dimmed.
const MULTI_CLASS_YAML = `
id: https://example.org/multi
name: multi
default_prefix: ex
prefixes:
  ex: https://example.org/

classes:
  Alpha:
    description: First class
    attributes:
      label:
        range: string

  Beta:
    description: Second class
    attributes:
      value:
        range: string

  Gamma:
    description: Third class
    is_a: Alpha
`.trim();

async function waitForHelper(page: Page) {
  await page.waitForFunction(() => !!(window as Window).__lme_e2e__, { timeout: 15_000 });
}

test('focus mode: dimmed nodes have opacity 0.3 and pointer-events none', async ({ page }) => {
  await page.goto('/');
  await waitForHelper(page);

  // ── 1. Load multi-class schema ─────────────────────────────────────────────
  await page.evaluate(
    (yaml) => window.__lme_e2e__.loadSchema(yaml),
    MULTI_CLASS_YAML,
  );
  await expect(page.locator('#lme-canvas-wrapper')).toBeVisible({ timeout: 10_000 });

  // Wait for all three class nodes to render.
  await expect(page.getByText('Alpha').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Beta').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Gamma').first()).toBeVisible({ timeout: 5_000 });

  // ── 2. Select "Alpha" node via store ──────────────────────────────────────
  // ReactFlow node IDs are the class names; setSelection drives the store.
  await page.evaluate(() => window.__lme_e2e__.setSelection(['Alpha']));

  // ── 3. Click "Focus Selection" toolbar button ──────────────────────────────
  const focusBtn = page.locator('#lme-focus-toolbar').getByText('Focus Selection');
  await expect(focusBtn).toBeVisible({ timeout: 5_000 });
  await expect(focusBtn).toBeEnabled({ timeout: 3_000 });
  await focusBtn.click();

  // ── 4. Focus banner should appear ─────────────────────────────────────────
  await expect(page.getByText(/1 node\(s\)/)).toBeVisible({ timeout: 5_000 });

  // ── 5. Assert dimmed nodes (Beta, Gamma) have opacity 0.3 ─────────────────
  // ReactFlow sets `style="opacity: 0.3; pointer-events: none;"` on the outer
  // `.react-flow__node` wrapper when the node is not in the focused set.
  const betaNode = page.locator('.react-flow__node[data-id="Beta"]');
  const gammaNode = page.locator('.react-flow__node[data-id="Gamma"]');

  await expect(betaNode).toHaveCSS('opacity', '0.3', { timeout: 5_000 });
  await expect(gammaNode).toHaveCSS('opacity', '0.3', { timeout: 5_000 });

  await expect(betaNode).toHaveCSS('pointer-events', 'none');
  await expect(gammaNode).toHaveCSS('pointer-events', 'none');

  // ── 6. The focused node (Alpha) must NOT be dimmed ────────────────────────
  const alphaNode = page.locator('.react-flow__node[data-id="Alpha"]');
  const alphaOpacity = await alphaNode.evaluate(
    (el) => window.getComputedStyle(el).opacity,
  );
  // opacity should be 1 (or absent from inline style, which resolves to 1).
  expect(Number(alphaOpacity)).toBeCloseTo(1, 1);

  // ── 7. Exit focus mode ────────────────────────────────────────────────────
  await page.locator('#lme-focus-toolbar').getByText('Exit Focus').click();

  // After exit all nodes should be interactive again.
  await expect(betaNode).not.toHaveCSS('pointer-events', 'none');
});
