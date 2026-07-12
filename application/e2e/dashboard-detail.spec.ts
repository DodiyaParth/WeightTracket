import { test, expect } from '@playwright/test';
import { ROUTES, waitForAppReady, hasNoHorizontalOverflow } from './helpers.js';

test.describe('dashboard detail responsive layout', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'this spec is about the mobile collapse; desktop keeps the multi-column layout');
  });

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
});
