import { test, expect } from '@playwright/test';
import { ROUTES, waitForAppReady, freezeClock } from './helpers.js';

// Pixel-diff regression baselines for the responsive work in Phases 2-6.
// Scoped to 'desktop' and 'mobile' (chromium-based) — skipping 'mobile-safari'
// here because cross-engine font/AA rendering differs enough from chromium
// to make a single shared tolerance either too loose or too flaky; webkit is
// still fully covered by every *functional* overflow/layout assertion in the
// other e2e/*.spec.ts files, just not by these pixel baselines.
//
// Caveat: snapshots are platform-specific (Playwright embeds the OS in the
// filename). These were generated on macOS/arm64. Regenerate on a different
// OS (e.g. in CI on Linux) with:
//   npx playwright test e2e/visual.spec.ts --update-snapshots
test.describe('visual baselines', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-safari', 'chromium-only baselines; see file header');
  });

  test('404 page', async ({ page }) => {
    // Static and auth-independent — no clock freeze needed.
    await page.goto('/#/this-page-does-not-exist');
    await page.waitForSelector('h2');
    await expect(page).toHaveScreenshot('not-found.png', { fullPage: true });
  });

  test('dashboard detail', async ({ page }) => {
    await freezeClock(page);
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    await page.waitForSelector('.streak-grid');
    await page.waitForTimeout(1200); // let Chart.js's initial-render animation settle
    await expect(page).toHaveScreenshot('dashboard-detail.png', { fullPage: true });
  });

  test('dashboards list', async ({ page }) => {
    await freezeClock(page);
    await page.goto(ROUTES.landing);
    await waitForAppReady(page);
    await page.goto(ROUTES.landing); // 2nd visit this session -> shows the list, not the redirect
    await waitForAppReady(page);
    await page.waitForSelector('.dash-card');
    await expect(page).toHaveScreenshot('dashboards-list.png', { fullPage: true });
  });

  test('history', async ({ page }) => {
    await freezeClock(page);
    await page.goto(ROUTES.history);
    await waitForAppReady(page);
    await expect(page).toHaveScreenshot('history.png', { fullPage: true });
  });

  test('add weight', async ({ page }) => {
    await freezeClock(page);
    await page.goto(ROUTES.addWeight);
    await waitForAppReady(page);
    await page.waitForSelector('.addweight-grid');
    await expect(page).toHaveScreenshot('add-weight.png', { fullPage: true });
  });

  test('profile', async ({ page }) => {
    await freezeClock(page);
    await page.goto(ROUTES.profile);
    await waitForAppReady(page);
    await expect(page).toHaveScreenshot('profile.png', { fullPage: true });
  });

  test('public view', async ({ page }) => {
    await freezeClock(page);
    await page.goto(ROUTES.public);
    await page.waitForSelector('.streak-grid');
    await page.waitForTimeout(1200);
    await expect(page).toHaveScreenshot('public-view.png', { fullPage: true });
  });
});
