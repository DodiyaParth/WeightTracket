import { test, expect, type Page } from '@playwright/test';
import { ROUTES, waitForAppReady, freezeClock, hasNoHorizontalOverflowSettled } from './helpers.js';

// Runs on every viewport project (desktop / mobile / mobile-safari / tablet)
// via the `*.all.spec.ts` testMatch, so the guided create flow is exercised on
// phones and desktop alike. The offline harness is signed in as the seed's
// `parth`, whose profile already has DOB + height — so the profile gate is
// skipped and the flow is the 6-step common path a returning user sees.

// The first visit to "/" redirects to the most-recently-active dashboard
// (landing behaviour); a second visit shows the actual dashboards list, whose
// Topbar carries the "New dashboard" button on every viewport. Freeze the clock
// first so the seed's weigh-ins and the wizard's todayISO() agree on "today"
// (the start date defaults to today, which then has a seeded weigh-in to
// prefill the start weight from).
async function openCreateWizard(page: Page): Promise<void> {
  await freezeClock(page);
  await page.goto(ROUTES.landing);
  await waitForAppReady(page);
  await page.goto(ROUTES.landing); // second visit → the list, not the redirect
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'New dashboard', exact: true }).click();
}

test.describe('guided goal wizard — create', () => {
  test('a first-timer can set a goal by accepting the suggestions', async ({ page }) => {
    await openCreateWizard(page);

    // Complete profile → gate skipped → an honest 6-step count.
    await expect(page.getByText('Step 1 of 6', { exact: true })).toBeVisible();
    // The wizard must not force the page wider than the viewport on any device.
    expect(await hasNoHorizontalOverflowSettled(page)).toBe(true);

    // Step 0 · Name
    await page.getByPlaceholder(/Me & Priya/).fill('Summer cut');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2 · Start date — default "Starting today", accept.
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3 · Start weight — prefilled from today's seeded weigh-in.
    await expect(page.getByLabel('Start weight in kg')).not.toHaveValue('');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 4 · Target weight
    await page.getByLabel('Target weight in kg').fill('80');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 5 · Target date — safe-pace date pre-filled, accept.
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 6 · Review — a plain restatement + the Create action.
    await expect(page.getByRole('heading', { name: 'Review & create' })).toBeVisible();
    await page.getByRole('button', { name: 'Create dashboard' }).click();

    // Lands on the freshly created dashboard, showing its name.
    await expect(page).toHaveURL(/#\/dashboard\//);
    await expect(page.getByRole('heading', { name: 'Summer cut' })).toBeVisible();
  });

  test('warnings never block: an out-of-range target keeps Continue enabled', async ({ page }) => {
    await openCreateWizard(page);
    await page.getByPlaceholder(/Me & Priya/).fill('Cut');
    await page.getByRole('button', { name: 'Continue' }).click(); // → start date
    await page.getByRole('button', { name: 'Continue' }).click(); // → start weight (prefilled)
    await page.getByRole('button', { name: 'Continue' }).click(); // → target

    // A very low target for a 1.78 m person is below the healthy band…
    await page.getByLabel('Target weight in kg').fill('45');
    await expect(page.getByText(/underweight territory/)).toBeVisible();
    // …but the primary stays enabled — guidance, not a gate.
    await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
});
