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

// Geometry assertions (boundingBox comparisons, centering checks, etc.) taken
// right after navigation can race two things that don't block `domcontentloaded`
// or a selector becoming visible: web fonts still swapping in (shifting glyph
// metrics/line-height) and the browser's own layout/paint settling under load.
// This showed up as an intermittent WebKit-only flake — never on Chromium —
// because parallel test workers contend for CPU and WebKit's font-swap timing
// differs from Chromium's. Waiting for `document.fonts.ready` plus a couple of
// animation frames with an unchanged bounding box makes these assertions
// measure the final, settled layout instead of a mid-render snapshot.
export async function waitForStableLayout(page: Page, selector: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  try {
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const w = window as unknown as { __lastRect?: string; __stableFrames?: number };
        const rect = el.getBoundingClientRect();
        const key = `${rect.x},${rect.y},${rect.width},${rect.height}`;
        if (w.__lastRect === key) {
          w.__stableFrames = (w.__stableFrames ?? 0) + 1;
        } else {
          w.__lastRect = key;
          w.__stableFrames = 0;
        }
        return (w.__stableFrames ?? 0) >= 4;
      },
      selector,
      { polling: 'raf', timeout: 5000 },
    );
  } catch {
    // Best-effort — if it never fully settles within the timeout, fall
    // through and let the caller's own assertion surface the real failure
    // instead of masking it behind an unrelated timeout error.
  }
}

// The core "did we break mobile layout" check: nothing should force the page
// wider than the viewport. A few px of slack covers scrollbar/rounding noise.
export async function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

// Pages with a Chart.js canvas go through a brief resize handshake right
// after mount — the canvas (and thus document.scrollWidth) can render at a
// stale, too-wide size for a moment before Chart.js's ResizeObserver settles
// it to match its container. Waiting for one proxy element to stop moving
// isn't quite enough (Chart.js's handshake can have more than one correction
// pass), so this polls the actual invariant under test — no horizontal
// overflow — until it holds for several consecutive frames, instead of
// snapshotting it once right after an indirect signal looks stable. Returns
// false (rather than throwing) if it never settles within `timeout`, so a
// genuine regression still fails the assertion with a clear true/false diff.
export async function hasNoHorizontalOverflowSettled(page: Page, timeout = 5000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __ovfStableFrames?: number };
        const ok = document.documentElement.scrollWidth <= window.innerWidth + 1;
        w.__ovfStableFrames = ok ? (w.__ovfStableFrames ?? 0) + 1 : 0;
        return (w.__ovfStableFrames ?? 0) >= 4;
      },
      { polling: 'raf', timeout },
    );
    return true;
  } catch {
    return hasNoHorizontalOverflow(page);
  }
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
