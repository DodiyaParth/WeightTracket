# WeightTracker

A static, no-server weight-loss web app: **React + Vite + Firebase (Auth + Firestore)**, deployed to
GitHub Pages. Product spec: [`documents/requirements.md`](documents/requirements.md).

## Layout

This repo has two independent projects:

| Directory | What | Notes |
|---|---|---|
| [`application/`](application) | The production app | React + Vite + Firebase. The repo root delegates to it by default. |
| [`design/`](design) | Throwaway UI prototype | Standalone design exploration — not production code. Run it from inside `design/`. |

## Quick start (the app)

Run everything from the repo root — these scripts delegate to `application/`:

```bash
npm run setup            # first time: install dependencies & Playwright browsers
npm run dev              # start the app  → http://localhost:5181
npm run build            # production bundle → application/dist/
npm test                 # unit tests (Vitest)
npm run test:e2e         # end-to-end tests (Playwright)
npm run test:e2e:install # install Playwright browsers manually if needed
npm run preview          # preview the production build
npm run seed             # seed the default Firestore account (see application/README.md)
```

Firebase keys live in `application/.env.local`. See [`application/README.md`](application/README.md) for the
full app docs (architecture, seeding, deployment).

## Pre-commit checks

`npm run setup` installs a Husky `pre-commit` hook (see [`.husky/pre-commit`](.husky/pre-commit)) that runs the
full application test suite with coverage — `npm run test:coverage` — before every commit. A commit is blocked if:

- any test fails, or
- statement or branch coverage drops below the 90% thresholds configured in
  [`application/vite.config.js`](application/vite.config.js).

If a commit is rejected, fix the failing test(s) or add coverage for the newly-uncovered lines/branches, then
re-run `git commit`. In a genuine emergency you can bypass the hook with `git commit --no-verify`, but treat that
as a last resort — it defeats the whole point of the gate.

## The design prototype

The design prototype is self-contained in [`design/`](design) and is run on its own:

```bash
cd design
npm install
npm run dev      # http://localhost:5180
npm run build    # → design/dist/
```
