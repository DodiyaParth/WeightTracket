import { test, expect } from '@playwright/test';
import { ROUTES, waitForAppReady, hasNoHorizontalOverflowSettled, waitForStableLayout } from './helpers.js';

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
    // Chart.js's `responsive: true` canvas briefly renders at a stale size
    // before its own ResizeObserver corrects it to match .chart-wrap — a
    // transient overflow that self-resolves a moment later (reproduces most
    // readily on WebKit's timing; see visual.spec.ts's comment on the same
    // settling behavior). Poll the actual overflow invariant until it holds
    // steady rather than guessing when Chart.js's resize handshake is done.
    expect(await hasNoHorizontalOverflowSettled(page)).toBe(true);
  });

  // Two-up, not one-up: a single full-width stat card at this width wastes
  // most of the screen on whitespace around one number (see styles.css's
  // .grid-4 rule at <=480px, and its <=360px fallback to one column for the
  // very narrowest phones this project's viewport doesn't hit).
  test('stat tiles lay out two-up, two rows', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    const tiles = page.locator('.stat-tile');
    await expect(tiles.first()).toBeVisible();

    const first = await tiles.nth(0).boundingBox();
    const second = await tiles.nth(1).boundingBox();
    const third = await tiles.nth(2).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();
    // Tile 1 sits beside tile 0 (same row, to its right)...
    expect(Math.abs((first?.y ?? 0) - (second?.y ?? 0))).toBeLessThan(2);
    expect((second?.x ?? 0)).toBeGreaterThan((first?.x ?? 0) + (first?.width ?? 0) - 2);
    // ...while tile 2 starts a new row, back in tile 0's column.
    expect(Math.abs((first?.x ?? 0) - (third?.x ?? 0))).toBeLessThan(2);
    expect(third?.y ?? 0).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0) - 2);
  });

  test('the chart card never forces the page wider than the viewport', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    // Same transient Chart.js resize race as the "fits the viewport" test
    // above — wait for the canvas's own box to settle before measuring it.
    await waitForStableLayout(page, 'canvas');
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

  // Regression for the person-selector chip row overflowing the viewport:
  // ".row.between" (no wrap) + ".seg" (white-space: nowrap) used to push the
  // chip group's right edge past the screen edge once 2+ tracked members'
  // real names widened it beyond the space left by the "Showing X's
  // stats..." label. See the `.person-focus` rule in styles.css.
  test('the person-selector chip row never extends past the viewport', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    const seg = page.locator('.person-focus .seg');
    await expect(seg).toBeVisible();
    const box = await seg.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
  });

  // Regression for the disconnected habit-row layout (DEV feedback #5): the
  // streak/actions meta must stay on the same line as the habit's own label,
  // not wrap onto its own right-aligned row below.
  test('a habit row keeps its label and streak/actions meta on one line', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    const row = page.locator('.habit-row').first();
    await expect(row).toBeVisible();
    await waitForStableLayout(page, '.habit-row');
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
