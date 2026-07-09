import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return undefined;
    }
    getRedirectResult(auth).catch((e) => setError(e?.code || 'sign-in-failed'));
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
    if (!isFirebaseConfigured) {
      setError('not-configured');
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const code = e?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (e2) {
          setError(e2?.code || 'sign-in-failed');
          return;
        }
      }
      setError(code || 'sign-in-failed');
    }
  };

  const signInWithEmail = async (email, password) => {
    setError(null);
    if (!isFirebaseConfigured) { setError('not-configured'); return false; }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (e) {
      setError(e?.code || 'sign-in-failed');
      return false;
    }
  };

  const signUpWithEmail = async (email, password) => {
    setError(null);
    if (!isFirebaseConfigured) { setError('not-configured'); return false; }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      return true;
    } catch (e) {
      setError(e?.code || 'sign-up-failed');
      return false;
    }
  };

  const signOutUser = async () => {
    if (!isFirebaseConfigured) return;
    // Landing flags are per-uid (wt_landed_{uid}) — clear them all so this
    // tab doesn't accumulate stale entries across sign-in/out cycles.
    try {
      Object.keys(sessionStorage).filter((k) => k.startsWith('wt_landed_')).forEach((k) => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
    await signOut(auth);
  };

  const value = useMemo(
    () => ({ user, loading, error, configured: isFirebaseConfigured, signInWithGoogle, signInWithEmail, signUpWithEmail, signOutUser }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
