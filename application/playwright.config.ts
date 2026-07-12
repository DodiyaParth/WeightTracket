import { defineConfig, devices } from '@playwright/test';

const PORT = 5182;
const baseURL = `http://localhost:${PORT}`;

// Runs the real app in real browsers at phone + desktop viewports — the one
// layer of verification that actually "sees" CSS layout, which jsdom/Vitest
// cannot (vite.config.ts's `test.css: false`). The dev server below is
// started with `--mode e2e` (see src/data/repo.ts + src/auth/AuthContext.tsx),
// so every spec runs fully offline against the seeded in-memory backend,
// signed in as the seed's "parth" user — no real Firebase project or
// credentials needed. A production build (`vite build`, default mode
// 'production') never takes this branch, so it never runs for real users
// (see data/repo.ts for the minor bundle-size caveat). Uses a dedicated port
// so it never collides with a `npm run dev` session a developer already has
// open on 5181.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Visual baselines (e2e/visual.spec.ts) tolerate a couple % of pixel drift —
  // font antialiasing and hairline rendering vary slightly run to run even on
  // the same machine/browser. Baselines are platform+browser-specific (see
  // that file's own comment for the cross-OS caveat).
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
  ],
  webServer: {
    command: `npm run dev -- --mode e2e --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
