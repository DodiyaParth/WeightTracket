import { test, expect } from '@playwright/test';
import { ROUTES, waitForAppReady } from './helpers.js';

// The off-canvas drawer (Phase 2) only exists below the 768px breakpoint —
// on desktop the exact same <Sidebar/> markup renders permanently visible.
// Scoped to the `mobile`/`mobile-safari` projects via playwright.config.ts's
// per-project `testMatch`, so this never runs (and never shows as skipped)
// on `desktop`.
test.describe('mobile nav drawer', () => {
  test('sidebar starts off-canvas and opens via the hamburger', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).not.toHaveClass(/open/);
    await expect(sidebar).not.toBeInViewport();

    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(sidebar).toHaveClass(/open/);
    await expect(sidebar).toBeInViewport();
  });

  test('closes via the scrim behind it', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);

    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.locator('.sidebar')).toHaveClass(/open/);

    // The scrim spans the full viewport, but the (narrower, higher z-index)
    // drawer visually sits on top of its left portion — click near the right
    // edge, which is always outside the drawer's own width, so the click
    // actually lands on the scrim instead of a nav link underneath it.
    const vw = page.viewportSize()?.width ?? 400;
    await page.locator('.sidebar-scrim').click({ position: { x: vw - 10, y: 40 } });
    await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  });

  test('navigating via the drawer closes it and changes the route', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('link', { name: /History/ }).click();

    await expect(page).toHaveURL(/#\/history$/);
    await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  });

  test('closes on Escape', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);

    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.locator('.sidebar')).toHaveClass(/open/);

    await page.keyboard.press('Escape');
    await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  });
});
