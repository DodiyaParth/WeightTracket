import { test, expect } from '@playwright/test';
import { ROUTES, waitForAppReady, hasNoHorizontalOverflow } from './helpers.js';

// Scoped to the `mobile`/`mobile-safari` projects via playwright.config.ts's
// per-project `testMatch` — desktop keeps the multi-column layout, so this
// never runs (and never shows as skipped) there.
test.describe('dashboard detail responsive layout', () => {
  // Now that Phase 5 has fixed HabitsSection's .streak-grid + .habit-row
  // (the last two things on this page that used to overflow), this can
  // assert the whole page, not just the stat-tile/content-2col area.
  test('fits the viewport with no horizontal scroll, end to end', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    await page.waitForSelector('.streak-grid');
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('stat tiles stack to a single column', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    const tiles = page.locator('.stat-tile');
    await expect(tiles.first()).toBeVisible();

    const first = await tiles.nth(0).boundingBox();
    const second = await tiles.nth(1).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    // Same column (same x), stacked below one another (second starts lower).
    expect(Math.abs((first?.x ?? 0) - (second?.x ?? 0))).toBeLessThan(2);
    expect(second?.y ?? 0).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0) - 2);
  });

  test('the chart card never forces the page wider than the viewport', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box?.x ?? 0).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  });

  // The BMI marker's vertical-centering regression (DEV feedback #6) is
  // covered by a unit test instead (DashboardBody.test.tsx) — this seed's
  // dashboards never populate the Firestore-only `memberUids` field the
  // profiles hook keys off (see data/memory.ts / data/seed.ts), so heightM
  // never resolves here and the BMI section always falls back to "Add
  // height in Profile" — a pre-existing gap in this offline harness, not a
  // regression from this change, and out of scope to fix here.

  // Regression for cut-looking streak cells (DEV feedback #4): each cell
  // must render at least at its intended 18px floor width.
  test('streak-grid cells never shrink below their tappable floor width', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    const cell = page.locator('.streak-grid .streak-cell').first();
    await expect(cell).toBeVisible();
    const box = await cell.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(17); // allow a hair of rounding
  });

  // Regression for the disconnected habit-row layout (DEV feedback #5): the
  // streak/actions meta must stay on the same line as the habit's own label,
  // not wrap onto its own right-aligned row below.
  test('a habit row keeps its label and streak/actions meta on one line', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    const row = page.locator('.habit-row').first();
    await expect(row).toBeVisible();
    // Direct children, in DOM order: check button, emoji span, label span,
    // then the .habit-row-meta span — so the label is span index 1.
    const labelBox = await row.locator('> span').nth(1).boundingBox();
    const metaBox = await row.locator('.habit-row-meta').boundingBox();
    expect(labelBox).not.toBeNull();
    expect(metaBox).not.toBeNull();
    // A few px of slack for cross-engine baseline/alignment differences —
    // a genuine wrap onto a second line would be off by the row's full
    // content height (well over 15px), not a couple of px.
    expect(Math.abs((labelBox?.y ?? 0) - (metaBox?.y ?? 0))).toBeLessThan(10);
  });
});
