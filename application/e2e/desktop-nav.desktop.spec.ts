import { test, expect } from '@playwright/test';
import { ROUTES, waitForAppReady } from './helpers.js';

// Desktop-only: the sidebar is always visible, no drawer to open/close.
// Scoped to the `desktop` project via playwright.config.ts's per-project
// `testMatch`, so this never runs (and never shows as skipped) on mobile.
test.describe('desktop nav', () => {
  test('sidebar is always visible — no drawer needed', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);

    await expect(page.locator('.sidebar')).toBeInViewport();
    await expect(page.getByRole('link', { name: /History/ })).toBeVisible();
  });
});
