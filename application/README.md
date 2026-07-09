# WeightTracker — Application

A static, no-server weight-loss web app: **React + Vite + Firebase (Auth + Firestore)**, deployed to
GitHub Pages. Product spec: [`../documents/requirements.md`](../documents/requirements.md). The design system is mirrored
from the designer's prototype in [`../design`](../design) (designer-owned — not edited here).

> **Status: Milestones 1–4 built.** Login + auth shell, personal data & weight entry (single / bulk /
> CSV), shared dashboards + invites, sharing (account read/edit **and** no-login read-only link),
> dashboard charts (Chart.js), per-person motivation engine, daily habits + streaks, goals & safety.

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

There is no offline/demo mode — `memory.js` + `seed.js` still exist, but only as the backend used by
the unit tests (`npm test`), not by the running app.

### Seeding the default account

```bash
cd application
npm run seed     # needs application/serviceAccount.json — see scripts/seed-firestore.mjs
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
  data/           Repository pattern:
    repo.js         always resolves to the Firestore backend
    firestore.js    Firestore backend (production — the only one the app uses)
    memory.js       in-memory backend — unit-test-only, not wired into repo.js
    seed.js         seed data — used by tests directly, and by scripts/seed-firestore.mjs
    bus.js          change bus → hooks refetch after mutations
  hooks/useData.js  useProfile / useWeights / useDashboards / useDashboard / ...
  auth/             AuthContext (Google + email/password sign-in, redirect fallback), ProtectedRoute
  components/       Layout, Chart (Chart.js), DashboardBody, QuickLog, ShareModal,
                    GoalEditor, DashSettings, MotivationCard, HabitsSection, CreateDashboard, ...
  pages/            Login, DashboardsList, DashboardDetail, AddWeight, Profile, PublicView
scripts/
  seed-firestore.mjs  Admin SDK script — seeds the default account (see "Seeding" above)
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

## Deploy (GitHub Pages)

`npm run build` → push `dist/` to your Pages branch (or use an action). `vite.config.js` uses
`base: './'` so it works under any `/<repo>/` path; HashRouter avoids deep-link 404s.

## What's verified vs. what needs your eyes

- **Verified:** unit tests pass; production build is clean; email/password and Google sign-in both work
  against real Firestore; every screen renders end-to-end (login, dashboards list, dashboard interior +
  chart, add weight, profile, public view); the quick-log write path works.
- **Needs live verification with two accounts:** multi-account collaboration (invite/accept, role
  changes, the `firestore.rules` self-join clause) — see `../documents/app-feedback-phases.md` Phase 3.
