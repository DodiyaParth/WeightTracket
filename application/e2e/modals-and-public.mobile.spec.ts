import { test, expect } from '@playwright/test';
import { ROUTES, waitForAppReady, hasNoHorizontalOverflow, hasNoHorizontalOverflowSettled, waitForStableLayout } from './helpers.js';

// Scoped to the `mobile`/`mobile-safari` projects via playwright.config.ts's
// per-project `testMatch` — desktop keeps the wider layout, so this never
// runs (and never shows as skipped) there.
test.describe('mobile: modals, dropdown, public view', () => {
  test('the notifications dropdown stays within the viewport', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    await page.getByRole('button', { name: 'Notifications' }).click();
    const box = await page.locator('.dropdown').boundingBox();
    const vw = page.viewportSize()?.width ?? 0;
    expect(box).not.toBeNull();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(vw + 1);
  });

  test('the share modal fits the viewport, including the invite-by-email row', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    await page.getByRole('button', { name: 'Share' }).click();
    await page.waitForSelector('.invite-row');
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    const vw = page.viewportSize()?.width ?? 0;
    const inviteBtn = page.getByRole('button', { name: 'Invite' });
    const box = await inviteBtn.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(vw + 1);

    // Regression for the "Read only" seg option clipping to "Rea only"
    // (DEV feedback #7): its full label text must render unclipped. Scoped
    // to .invite-row — existing members each have their own "Read only"
    // access-level radio too.
    const readOnlyOption = page.locator('.invite-row').getByRole('radio', { name: 'Read only' });
    await expect(readOnlyOption).toBeVisible();
    const clientWidth = await readOnlyOption.evaluate((el) => el.clientWidth);
    const scrollWidth = await readOnlyOption.evaluate((el) => el.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('the dashboard settings modal fits the viewport with stacked footer buttons', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    await page.getByRole('button', { name: 'Dashboard settings' }).click();
    await page.waitForSelector('.modal-foot');
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    const cancel = await page.getByRole('button', { name: 'Cancel' }).boundingBox();
    const save = await page.getByRole('button', { name: 'Save settings' }).boundingBox();
    expect(cancel).not.toBeNull();
    expect(save).not.toBeNull();
    // Stacked, not side by side: same x, save (primary) above cancel.
    expect(Math.abs((cancel?.x ?? 0) - (save?.x ?? 0))).toBeLessThan(2);
    expect((save?.y ?? 0) + (save?.height ?? 0)).toBeLessThanOrEqual((cancel?.y ?? 0) + 2);
  });

  test('quick-log opens full-width and fits the viewport', async ({ page }) => {
    await page.goto(ROUTES.dashboard);
    await waitForAppReady(page);
    await page.getByRole('button', { name: /log my weight/i }).click();
    await page.waitForSelector('.modal.quicklog');
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('the public (no-login) view fits the viewport', async ({ page }) => {
    await page.goto(ROUTES.public);
    await page.waitForSelector('.public-top');
    await page.waitForSelector('.streak-grid');
    // Same transient Chart.js resize race as dashboard-detail.mobile.spec.ts's
    // "fits the viewport" test — poll the overflow invariant until it settles.
    expect(await hasNoHorizontalOverflowSettled(page)).toBe(true);
  });

  // Regression for the BMI marker hanging below its bar (DEV feedback #6).
  // The public view is used here (rather than the signed-in dashboard route)
  // because its profiles come from a dedicated per-dashboard lookup instead
  // of the memberUids-keyed hook the signed-in route uses — see
  // dashboard-detail.mobile.spec.ts's comment for why heightM/BMI never
  // resolves there in this offline seed.
  test('the BMI marker sits vertically centered over its bar, not below it', async ({ page }) => {
    await page.goto(ROUTES.public);
    await page.waitForSelector('.public-top');
    await page.waitForSelector('.bmi-bar');
    await waitForStableLayout(page, '.bmi-bar');
    const bar = page.locator('.bmi-bar').first();
    const barBox = await bar.boundingBox();
    const markerBox = await bar.locator('span').first().boundingBox();
    expect(barBox).not.toBeNull();
    expect(markerBox).not.toBeNull();
    const barCenter = (barBox?.y ?? 0) + (barBox?.height ?? 0) / 2;
    const markerCenter = (markerBox?.y ?? 0) + (markerBox?.height ?? 0) / 2;
    expect(Math.abs(barCenter - markerCenter)).toBeLessThan(2);
  });
});
