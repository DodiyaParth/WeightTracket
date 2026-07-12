// Single entry point for data access. Components import `repo` and call e.g.
// repo.addWeight(...) without caring about the backend. Production always uses
// Firestore — `memory.js` + `seed.js` remain as the unit-test backend only
// (tests import them directly, not through here).
//
// Typing this as `DataRepo` makes the "mirrors the memory backend's async
// API" contract a compile-time check (see memory.ts's own conformance
// assertion) instead of an informal comment.
import * as firestore from './firestore.js';
import type { DataRepo } from './DataRepo.js';

export const repo: DataRepo = firestore;
