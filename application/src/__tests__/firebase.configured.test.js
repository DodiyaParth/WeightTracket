import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The default test env forces the VITE_FIREBASE_* keys empty (see vite.config.js),
// so the sibling firebase.test.js exercises the graceful-degradation path. Here we
// stub the SDK + env and re-import the module to cover the real init branch.
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({ __app: true })) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ __auth: true })),
  GoogleAuthProvider: class {
    constructor() { this.providerId = 'google.com'; this._params = {}; }
    setCustomParameters(p) { this._params = p; }
    getCustomParameters() { return this._params; }
  },
}));
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn(() => ({ __db: true })) }));

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllEnvs(); });

describe('firebase (configured)', () => {
  it('initializes app/auth/db when the essential keys are present', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'k');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'd.example.com');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'proj');
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'app-1');

    const { initializeApp } = await import('firebase/app');
    const { getAuth } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');
    const mod = await import('../firebase.js');

    expect(mod.isFirebaseConfigured).toBe(true);
    expect(initializeApp).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'k', projectId: 'proj' }));
    expect(getAuth).toHaveBeenCalled();
    expect(getFirestore).toHaveBeenCalled();
    expect(mod.app).toEqual({ __app: true });
    expect(mod.auth).toEqual({ __auth: true });
    expect(mod.db).toEqual({ __db: true });
    expect(mod.googleProvider.getCustomParameters()).toMatchObject({ prompt: 'select_account' });
  });
});
