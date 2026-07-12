import type { Page } from '@playwright/test';

// Deep links used across specs. HashRouter means the path lives after '#',
// so these are relative to playwright.config.ts's baseURL.
export const ROUTES = {
  landing: '/#/',
  dashboard: '/#/dashboard/d1',
  addWeight: '/#/add',
  history: '/#/history',
  profile: '/#/profile',
  public: '/#/s/demo-9fa2kq7x',
} as const;

// True once the app shell has rendered its real content — i.e. past the auth
// Splash screen and any data-loading skeleton. Most routes render an `<h1>`
// (Layout's Topbar); the unauthenticated PublicView route has no Layout, so
// it's keyed off its own header instead.
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('h1, .public-top', { state: 'visible' });
}

// The core "did we break mobile layout" check: nothing should force the page
// wider than the viewport. A few px of slack covers scrollbar/rounding noise.
export async function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

// The seed data (see data/seed.ts) generates weight history, "updated Xd
// ago" timestamps, and streak-grid days all relative to `Date.now()` at
// import time — so screenshots taken on different days would never match a
// stored baseline pixel-for-pixel. Freezing the clock before navigation
// (must be called before page.goto) makes every render of that data 100%
// reproducible, since none of it uses Math.random().
export async function freezeClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date('2026-07-01T09:00:00Z'));
}
