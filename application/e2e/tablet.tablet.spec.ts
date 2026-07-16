import { test, expect } from '@playwright/test';
import { ROUTES, waitForAppReady, hasNoHorizontalOverflow, hasNoHorizontalOverflowSettled } from './helpers.js';

// Scoped to the `tablet` project via playwright.config.ts's `testMatch`
// (an 810px-wide iPad preset — inside the new @media(max-width:1024px) tier
// in styles.css, but above the 768px phone tier, so the sidebar/topbar stay
// desktop-shaped and only the tablet-specific overrides apply). Desktop and
// phone each have their own overflow coverage already (visual.spec.ts /
// dashboard-detail.mobile.spec.ts + list-history-profile.mobile.spec.ts);
// this fills the gap in between.
test.describe('tablet: core pages fit the viewport', () => {
  test('dashboard detail fits the viewport and stacks the chart/goals columns', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    await page.waitForSelector('.streak-grid');
    // Poll the overflow invariant until Chart.js's resize handshake settles
    // (see visual.spec.ts and dashboard-detail.mobile.spec.ts for the same race).
    expect(await hasNoHorizontalOverflowSettled(page)).toBe(true);

    // .content-2col collapses to a single column at <=1024px (see
    // styles.css) — the chart card and the BMI/motivation card below it end
    // up in the same column instead of side by side.
    const chartCard = page.locator('.chart-wrap').first();
    const bmiHeading = page.getByText('BMI & healthy range');
    const chartBox = await chartCard.boundingBox();
    const bmiBox = await bmiHeading.boundingBox();
    expect(chartBox).not.toBeNull();
    expect(bmiBox).not.toBeNull();
    expect(Math.abs((chartBox?.x ?? 0) - (bmiBox?.x ?? 0))).toBeLessThan(2);
  });

  test('dashboards list fits the viewport', async ({ page }) => {
    await page.goto(ROUTES.landing);
    await waitForAppReady(page);
    await page.goto(ROUTES.landing);
    await waitForAppReady(page);
    await page.waitForSelector('.dash-card');
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('history fits the viewport in both list and calendar view', async ({ page }) => {
    await page.goto(ROUTES.history);
    await waitForAppReady(page);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    await page.getByRole('radio', { name: 'Calendar' }).click();
    await page.waitForSelector('.cal-grid');
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('profile fits the viewport', async ({ page }) => {
    await page.goto(ROUTES.profile);
    await waitForAppReady(page);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});
