import { test, expect } from '@playwright/test';
import { ROUTES, waitForAppReady, hasNoHorizontalOverflow } from './helpers.js';

test.describe('mobile: modals, dropdown, public view', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'these checks are about the mobile collapse; desktop keeps the wider layout');
  });

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
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});
