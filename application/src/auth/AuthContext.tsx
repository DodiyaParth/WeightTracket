import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../firebase.js';
import { repo } from '../data/repo.js';
import { errorCode } from '../lib/errors.js';
import type { AuthUser } from '../types.js';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (email: string, password: string) => Promise<boolean>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// True only under Vite's "e2e" mode (see playwright.config.ts), so the e2e
// suite can drive every authenticated screen offline, without real Firebase
// credentials. Mirrors the memory-backend swap in data/repo.ts — same
// literal-string-mode reasoning applies (dead-code-eliminated from real
// builds). Never true in the Vitest env (mode is 'test' there), so these
// branches are excluded from the coverage gate below.
const isE2E = import.meta.env.MODE === 'e2e';

// uid must match data/seed.ts's DEMO_UID so repo.ensureProfile(E2E_USER)
// resolves to the pre-seeded "Parth" profile instead of minting a blank one.
const E2E_USER: AuthUser = { uid: 'parth', displayName: 'Parth', email: 'parth@weighttracker.app', photoURL: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  /* v8 ignore next */
  const [user, setUser] = useState<AuthUser | null>(isE2E ? E2E_USER : null);
  /* v8 ignore next */
  const [loading, setLoading] = useState(isE2E ? false : isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /* v8 ignore start */
    if (isE2E) {
      setLoading(false);
      return undefined;
    }
    /* v8 ignore stop */
    if (!auth) {
      setLoading(false);
      return undefined;
    }
    getRedirectResult(auth).catch((e) => setError(errorCode(e) || 'sign-in-failed'));
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // Make sure the user has a profile document (first sign-in).
  useEffect(() => {
    if (user) repo.ensureProfile(user).catch(() => {});
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const signInWithGoogle = async () => {
    setError(null);
    if (!auth) {
      setError('not-configured');
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const code = errorCode(e) || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (e2) {
          setError(errorCode(e2) || 'sign-in-failed');
          return;
        }
      }
      setError(code || 'sign-in-failed');
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setError(null);
    if (!auth) { setError('not-configured'); return false; }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (e) {
      setError(errorCode(e) || 'sign-in-failed');
      return false;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    setError(null);
    if (!auth) { setError('not-configured'); return false; }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      return true;
    } catch (e) {
      setError(errorCode(e) || 'sign-up-failed');
      return false;
    }
  };

  const signOutUser = async () => {
    if (!auth) return;
    // Landing flags are per-uid (wt_landed_{uid}) — clear them all so this
    // tab doesn't accumulate stale entries across sign-in/out cycles.
    try {
      Object.keys(sessionStorage).filter((k) => k.startsWith('wt_landed_')).forEach((k) => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
    await signOut(auth);
  };

  const value = useMemo(
    /* v8 ignore next */
    () => ({ user, loading, error, configured: isE2E ? true : isFirebaseConfigured, signInWithGoogle, signInWithEmail, signUpWithEmail, signOutUser }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
