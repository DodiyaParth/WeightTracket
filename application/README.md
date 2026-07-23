# WeightTracker — Application

A static, no-server weight-loss web app: **React + Vite + Firebase (Auth + Firestore)**, deployed to
GitHub Pages. Product spec: [`../documents/requirements.md`](../documents/requirements.md). The design system is mirrored
from the designer's prototype in [`../design`](../design) (designer-owned — not edited here).

> **Status: Milestones 1–4 built.** Login + auth shell, personal data & weight entry (single / bulk /
> CSV), shared dashboards + invites, sharing (account read/edit **and** no-login read-only link),
> dashboard charts (Chart.js), per-person motivation engine, daily habits + streaks, goals & safety.
> The UI is responsive down to phone widths (off-canvas nav drawer, collapsing grids/tables) — see
> "End-to-end tests" below for how that's verified in real browsers.

## Quick start

```bash
cd application
npm install
npm run dev      # http://localhost:5181
npm test         # unit tests (Vitest)
npm run build    # production bundle → dist/
```

Firebase keys live in `.env.local` (already set for project `weighttracker-80064`). See `.env.example`
for the variable names.

## Signing in

The app always talks to real Firestore — sign in with Google or email/password. There's a shared
default account seeded with a rich demo world (Parth & Priya + a wider cast) for quickly looking at a
populated dashboard: run `npm run seed` once (see below) and sign in with its printed credentials.

There is no offline/demo mode for regular dev/production use — `memory.ts` + `seed.ts` are the backend
used by the unit tests (`npm test`), and are also what the Playwright e2e suite runs against (see below)
so it doesn't need a real Firebase project.

### Seeding the default account

```bash
cd application
npm run seed     # needs application/serviceAccount.json — see scripts/seed-firestore.ts
```

Downloads-and-writes are one-time setup: get a service account key from Firebase console → Project
settings → Service accounts → "Generate new private key", save it as `application/serviceAccount.json`
(already gitignored — never commit it), then run the script. It's safe to re-run any time to refresh the
seeded data.

## Architecture

```
src/
  lib/            Pure, unit-tested domain logic (no React, no Firebase):
    date.js         calendar math + flexible date parsing/detection (CSV)
    stats.js        EMA trend, weekly rate, multi-window deltas, honest projection
    health.js       BMI, healthy band, safe-pace + goal pace checks, ideal-line verdict
    motivation.js   per-person state machine + copy + milestones
    habits.js       forgiving streaks, grid kinds
    dashboards.js   access model (owner/editor/viewer), recents, post-login landing
    csv.js          format-flexible CSV import (papaparse + detection)
    __tests__/      Vitest specs covering the above
  data/           Repository pattern (see DataRepo.ts for the shared interface):
    repo.ts         Firestore in production; swaps to the memory backend under
                     Vite's "e2e" mode (see "End-to-end tests" below)
    firestore.ts    Firestore backend (production)
    memory.ts       in-memory backend — used by unit tests directly, and by
                     repo.ts under e2e mode
    seed.ts         seed data — used by tests directly, and by scripts/seed-firestore.ts
  hooks/useData.js  useProfile / useWeights / useDashboards / useDashboard / ...
  auth/             AuthContext (Google + email/password sign-in, redirect fallback), ProtectedRoute
  components/       Layout, Chart (Chart.js), DashboardBody, QuickLog, ShareModal,
                    GoalEditor, DashSettings, MotivationCard, HabitsSection, CreateDashboard, ...
  pages/            Login, DashboardsList, DashboardDetail, AddWeight, Profile, PublicView
scripts/
  seed-firestore.ts  Admin SDK script — seeds the default account (see "Seeding" above)
```

The heavy, bug-prone logic is **pure and unit-tested**; Firebase is a thin I/O layer.

### Firestore data model (see `firestore.rules`)

```
users/{uid}                      profile                       (self read/write)
users/{uid}/weights/{date}       canonical weight history      (owner-only — weight is self-only)
dashboards/{id}                  members map + memberUids[] + goals + teamGoal + habits + public
dashboards/{id}/series/{uid}     denormalized {date,kg} for display (self-write, member-read)
dashboards/{id}/habitLogs/{uid}  habit completions             (self-write, member-read)
dashboards/{id}/nsv/{noteId}     non-scale-victory notes
invites/{id}                     collaboration invites (queried by toEmail)
publicViews/{token}              world-readable snapshot for the no-login link
```

Weight is **owner-write only**; co-members read a denormalized `series` copy, and the no-login link
reads a `publicViews/{token}` snapshot (REQUIREMENTS §3.4).

## Deploying Firestore (needed before the production path works)

1. **Create the database**: Firebase console → Build → Firestore Database → Create.
2. **Publish the rules** in [`firestore.rules`](firestore.rules): paste into console → Rules, or
   `firebase deploy --only firestore:rules`.
3. **Authorized domains**: Authentication → Settings → add your GitHub Pages domain. `localhost` is
   already allowed for dev.

## End-to-end tests (Playwright)

Unit tests run in jsdom, which never applies CSS — so responsive/layout changes can only really be
verified by rendering the app in a real browser at real viewport sizes. That's what
[`playwright.config.ts`](playwright.config.ts) + [`e2e/`](e2e/) are for.

```bash
npm run test:e2e:install # download Playwright browsers (included in root `npm run setup`)
npm run test:e2e       # headless, all projects (desktop, mobile, mobile-safari)
npm run test:e2e:ui    # Playwright's interactive UI mode — good for debugging one spec
```

The suite starts its **own** dev server on a dedicated port (5182, so it never collides with a
`npm run dev` session you already have open on 5181), with Vite's `mode` set to `"e2e"`. That one flag
does two things (see `data/repo.ts` + `auth/AuthContext.tsx`):

- `repo` resolves to the **in-memory backend** (`data/memory.ts` + `data/seed.ts`) instead of Firestore.
- `AuthContext` starts already signed in as the seed's "parth" user — no real Google/email sign-in flow.

So every spec runs fully offline, with no Firebase project, credentials, or network access needed.
`vite build`'s default mode (`"production"`) never takes this branch.

**What's covered:**

- `smoke.all.spec.ts` — the offline harness itself: landing redirect, every protected route reachable,
  the public (no-login) link. Runs on all three projects.
- `mobile-nav.mobile.spec.ts` — the off-canvas nav drawer (open/close via hamburger, scrim, Escape, nav
  click). `desktop-nav.desktop.spec.ts` — the desktop-only equivalent (sidebar always visible, no
  drawer).
- `dashboard-detail.mobile.spec.ts`, `list-history-profile.mobile.spec.ts`, `addweight.mobile.spec.ts`,
  `modals-and-public.mobile.spec.ts` — per-area "no horizontal overflow at phone widths" +
  layout-collapse assertions (stacked grids, wrapped rows, etc.), scoped to the phone projects.
- `visual.spec.ts` — pixel-diff baselines (`toHaveScreenshot`) for `desktop` + `mobile` only (chromium
  engines; `mobile-safari`/webkit has its own font rendering and isn't included in these, though it's
  still covered by every functional spec above). The clock is frozen (`page.clock.setFixedTime`) before
  navigating on data-heavy pages, since the seed data is generated relative to "now" and would otherwise
  drift the screenshots every day. **Snapshots are platform-specific** (checked in under
  `e2e/visual.spec.ts-snapshots/`, generated on macOS/arm64) — regenerate on a different OS with
  `npx playwright test e2e/visual.spec.ts --update-snapshots`. CI (`.github/workflows/ci.yml`, Linux)
  skips this one spec for that reason and runs everything else.

**Naming convention:** each spec's filename says which Playwright projects it targets —
`*.all.spec.ts` (all three), `*.mobile.spec.ts` (`mobile` + `mobile-safari`), or `*.desktop.spec.ts`
(`desktop` only). `playwright.config.ts` gives each project a matching `testMatch`, so e.g. a
mobile-only spec is never even collected for `desktop` — it doesn't apply there, so it isn't scheduled,
rather than being scheduled and reported as "skipped". `visual.spec.ts` keeps its plain name and is
listed explicitly for `desktop`/`mobile` (see above for why `mobile-safari` is left off).

Kept out of the pre-commit hook (see `.husky/pre-commit`) — it's already a full typecheck + coverage
run on every commit, and spinning up a browser on top of that would make commits noticeably slower.
Run `test:e2e` manually, or rely on CI.

**Coverage scope:** `test:coverage` (Vitest + `@vitest/coverage-v8`, gated at 90% statements/branches,
see below) measures only the jsdom unit-test suite in `src/**` — it does not include anything exercised
solely by these Playwright specs, and there's no plan to merge the two into one number. They're
deliberately separate: Vitest runs in jsdom with `test.css: false` (see above), so it can't see CSS/layout
at all — that's exactly what this e2e suite exists to check instead. Collecting comparable coverage from
real-browser Playwright runs would mean instrumenting a second, separately-built app (Chromium-only;
`mobile-safari`/webkit has no practical V8-coverage story) and merging two differently-shaped coverage
formats with a third-party tool (e.g. `monocart-coverage-reports`) — extra moving parts for a number that
would mostly restate "the e2e suite ran," not surface new source lines the unit suite is missing. If a
combined report is ever wanted, add it as a separate, non-gating artifact rather than folding it into the
90/90 threshold Vitest already enforces.

## Deploy (GitHub Pages)

`npm run build` → push `dist/` to your Pages branch (or use an action). `vite.config.js` uses
`base: './'` so it works under any `/<repo>/` path; HashRouter avoids deep-link 404s.

## What's verified vs. what needs your eyes

- **Verified:** unit tests pass; production build is clean; email/password and Google sign-in both work
  against real Firestore; every screen renders end-to-end (login, dashboards list, dashboard interior +
  chart, add weight, profile, public view); the quick-log write path works; every screen is responsive
  down to phone widths with no horizontal overflow, verified in real chromium + webkit browsers (see
  "End-to-end tests" above).
- **Needs live verification with two accounts:** multi-account collaboration (invite/accept, role
  changes, the `firestore.rules` self-join clause) — see `../documents/app-feedback-phases.md` Phase 3.
