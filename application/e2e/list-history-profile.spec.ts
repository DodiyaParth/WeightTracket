import { test, expect } from '@playwright/test';
import { ROUTES, waitForAppReady, hasNoHorizontalOverflow } from './helpers.js';

test.describe('mobile: dashboards list, history, profile', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'these checks are about the mobile collapse; desktop keeps the multi-column layout');
  });

  test('dashboards list fits the viewport, cards stack, and the invite row does not overflow', async ({ page }) => {
    // First visit this session redirects to the most-recently-active
    // dashboard (see App.tsx's Landing); the second visit shows the list.
    await page.goto(ROUTES.landing);
    await waitForAppReady(page);
    await page.goto(ROUTES.landing);
    await waitForAppReady(page);
    await page.waitForSelector('.dash-card');
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    const cards = page.locator('.dash-card');
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(Math.abs((first?.x ?? 0) - (second?.x ?? 0))).toBeLessThan(2);
    expect(second?.y ?? 0).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0) - 2);

    // The seed data (see data/seed.ts) gives "parth" a pending invite from
    // Arjun — its Decline/Accept row must stay inside the viewport too.
    const inviteRow = page.locator('.invite-card').first();
    await expect(inviteRow).toBeVisible();
    const vw = page.viewportSize()?.width ?? 0;
    const acceptBtn = page.getByRole('button', { name: /Accept/ });
    const box = await acceptBtn.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(vw + 1);
  });

  test('history fits the viewport in both list and calendar view', async ({ page }) => {
    await page.goto(ROUTES.history);
    await waitForAppReady(page);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    await page.getByRole('radio', { name: 'Calendar' }).click();
    await page.waitForSelector('.cal-grid');
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('profile fits the viewport with a full-width sign-out button', async ({ page }) => {
    await page.goto(ROUTES.profile);
    await waitForAppReady(page);
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    // Scoped to the Account card — "Sign out" also matches the (always-in-DOM,
    // off-canvas-on-mobile) sidebar's icon-only sign-out button.
    const accountCard = page.locator('.card.flat');
    const card = await accountCard.boundingBox();
    const signOut = await accountCard.getByRole('button', { name: 'Sign out' }).boundingBox();
    expect(card).not.toBeNull();
    expect(signOut).not.toBeNull();
    // "full-width" relative to its own card, not the viewport.
    expect(signOut?.width ?? 0).toBeGreaterThan((card?.width ?? 0) * 0.85);
  });
});
