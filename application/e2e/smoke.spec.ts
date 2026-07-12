import { test, expect } from '@playwright/test';
import { ROUTES, waitForAppReady } from './helpers.js';

// Proves the offline E2E harness (VITE_E2E=1 -> memory backend + fake signed-in
// user, see playwright.config.ts) actually works, on every viewport project.
test.describe('offline harness smoke', () => {
  test('signed-in landing redirects to the most recently active dashboard', async ({ page }) => {
    await page.goto(ROUTES.landing);
    await waitForAppReady(page);
    await expect(page).toHaveURL(/#\/dashboard\/d1$/);
    await expect(page.getByRole('heading', { name: 'Parth & Priya' })).toBeVisible();
  });

  test('protected routes are reachable without a real Firebase sign-in', async ({ page }) => {
    await page.goto(ROUTES.addWeight);
    await waitForAppReady(page);
    await expect(page).toHaveURL(/#\/add$/);

    await page.goto(ROUTES.history);
    await waitForAppReady(page);
    await expect(page).toHaveURL(/#\/history$/);

    await page.goto(ROUTES.profile);
    await waitForAppReady(page);
    await expect(page).toHaveURL(/#\/profile$/);
  });

  test('public link renders seeded data with no auth at all', async ({ page }) => {
    await page.goto(ROUTES.public);
    await expect(page.getByText('Parth & Priya')).toBeVisible();
  });
});
