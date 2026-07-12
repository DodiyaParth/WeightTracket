import { test, expect } from '@playwright/test';
import { ROUTES, waitForAppReady, hasNoHorizontalOverflow } from './helpers.js';

test.describe('add weight responsive layout', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'this spec is about the mobile collapse; desktop keeps the multi-column layout');
  });

  test('single-entry tab fits the viewport', async ({ page }) => {
    await page.goto(ROUTES.addWeight);
    await waitForAppReady(page);
    await page.waitForSelector('.addweight-grid');
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('bulk backfill tab: the table scrolls internally instead of the page overflowing', async ({ page }) => {
    await page.goto(ROUTES.addWeight);
    await waitForAppReady(page);
    await page.getByRole('button', { name: 'Bulk backfill' }).click();
    await page.waitForSelector('.tbl-wrap .tbl');
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });

  test('CSV import tab: dropzone view and the parsed review both fit', async ({ page }) => {
    await page.goto(ROUTES.addWeight);
    await waitForAppReady(page);
    await page.getByRole('button', { name: 'CSV import' }).click();
    await page.waitForSelector('.dropzone');
    expect(await hasNoHorizontalOverflow(page)).toBe(true);

    const csv = 'date,weight_kg\n2026-01-01,80.0\n2026-01-02,79.8\n';
    await page.locator('input[type="file"]').setInputFiles({
      name: 'weights.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await page.waitForSelector('.tbl-wrap .tbl');
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});
