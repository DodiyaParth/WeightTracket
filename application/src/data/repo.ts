// Single entry point for data access. Components import `repo` and call e.g.
// repo.addWeight(...) without caring about the backend. Production normally
// uses Firestore — `memory.js` + `seed.js` are the unit-test backend, and are
// also swapped in here when running under Vite's "e2e" mode (see
// playwright.config.ts) so the Playwright suite (e2e/) can drive the whole
// app offline against seeded data (see AuthContext.tsx for the matching
// fake-auth-user swap).
//
// `import.meta.env.MODE` (unlike an arbitrary custom VITE_* var) is one of
// the handful of env keys Vite always statically inlines as a literal
// string, so a production build (`mode: 'production'`) constant-folds the
// `memory` branch to unreachable code — it's never *executed* for real
// users. (seed.ts's small, deterministic data table itself can still end up
// physically present in the output bundle, since Rollup conservatively keeps
// modules with top-level initializers; that's a minor bundle-size nit, not a
// behavioral one.) Not reachable from unit tests either (Vitest's mode is
// 'test'), so excluded from coverage below.
//
// Typing this as `DataRepo` makes the "mirrors the memory backend's async
// API" contract a compile-time check (see memory.ts's own conformance
// assertion) instead of an informal comment.
import * as firestore from './firestore.js';
import * as memory from './memory.js';
import type { DataRepo } from './DataRepo.js';

/* v8 ignore next */
export const repo: DataRepo = import.meta.env.MODE === 'e2e' ? memory : firestore;
