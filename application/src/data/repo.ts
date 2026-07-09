// Single entry point for data access. Components import `repo` and call e.g.
// repo.addWeight(...) without caring about the backend. Production always uses
// Firestore — `memory.js` + `seed.js` remain as the unit-test backend only
// (tests import them directly, not through here).
import * as firestore from './firestore.js';

export const repo = firestore;
export { bus } from './bus.js';
