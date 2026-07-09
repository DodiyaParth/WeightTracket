import { describe, it, expect } from 'vitest';
import { isFirebaseConfigured, app, auth, db, googleProvider } from '../firebase.js';

// With no VITE_FIREBASE_* values (forced empty in vite.config.js test.env),
// firebase.js must degrade gracefully rather than initialize a real app.
describe('firebase (unconfigured test env)', () => {
  it('reports itself as not configured', () => {
    expect(isFirebaseConfigured).toBe(false);
  });

  it('does not initialize app/auth/db', () => {
    expect(app).toBe(null);
    expect(auth).toBe(null);
    expect(db).toBe(null);
  });

  it('still exposes a Google provider set to prompt for account selection', () => {
    expect(googleProvider).toBeTruthy();
    expect(googleProvider.providerId).toBe('google.com');
    expect(googleProvider.getCustomParameters()).toMatchObject({ prompt: 'select_account' });
  });
});
