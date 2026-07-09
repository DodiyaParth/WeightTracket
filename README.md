# WeightTracker

A static, no-server weight-loss web app: **React + Vite + Firebase (Auth + Firestore)**, deployed to
GitHub Pages. Product spec: [`REQUIREMENTS.md`](REQUIREMENTS.md).

## Layout

This repo has two independent projects:

| Directory | What | Notes |
|---|---|---|
| [`application/`](application) | The production app | React + Vite + Firebase. The repo root delegates to it by default. |
| [`design/`](design) | Throwaway UI prototype | Standalone design exploration — not production code. Run it from inside `design/`. |

## Quick start (the app)

Run everything from the repo root — these scripts delegate to `application/`:

```bash
npm run setup    # first time: install application/ dependencies
npm run dev      # start the app  → http://localhost:5181
npm run build    # production bundle → application/dist/
npm test         # unit tests (Vitest)
npm run preview  # preview the production build
npm run seed     # seed the default Firestore account (see application/README.md)
```

Firebase keys live in `application/.env.local`. See [`application/README.md`](application/README.md) for the
full app docs (architecture, seeding, deployment).

## The design prototype

The design prototype is self-contained in [`design/`](design) and is run on its own:

```bash
cd design
npm install
npm run dev      # http://localhost:5180
npm run build    # → design/dist/
```
