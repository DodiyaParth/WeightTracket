import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Pretend Firebase IS configured so the provider exercises the real sign-in
// paths (the default test env forces it OFF; see vite.config.js).
vi.mock('../../firebase.js', () => ({
  auth: { __fake: 'auth' },
  googleProvider: { __fake: 'provider' },
  isFirebaseConfigured: true,
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => () => {}),
  getRedirectResult: vi.fn(() => Promise.resolve(null)),
  signInWithPopup: vi.fn(() => Promise.resolve()),
  signInWithRedirect: vi.fn(() => Promise.resolve()),
  signInWithEmailAndPassword: vi.fn(() => Promise.resolve({})),
  createUserWithEmailAndPassword: vi.fn(() => Promise.resolve({})),
  signOut: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../data/repo.js', () => ({
  repo: { ensureProfile: vi.fn(() => Promise.resolve({})) },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import {
  onAuthStateChanged, getRedirectResult, signInWithPopup, signInWithRedirect,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
} from 'firebase/auth';
import { repo } from '../../data/repo.js';
import { AuthProvider, useAuth } from '../AuthContext.jsx';

const setup = () => renderHook(() => useAuth(), { wrapper: AuthProvider });

beforeEach(() => {
  vi.clearAllMocks();
  onAuthStateChanged.mockReturnValue(() => {});
  getRedirectResult.mockResolvedValue(null);
  signInWithPopup.mockResolvedValue();
  signInWithRedirect.mockResolvedValue();
  signInWithEmailAndPassword.mockResolvedValue({});
  createUserWithEmailAndPassword.mockResolvedValue({});
  signOut.mockResolvedValue();
  repo.ensureProfile.mockResolvedValue({});
});

describe('AuthContext (Firebase configured)', () => {
  it('starts in loading state and reports configured', () => {
    const { result } = setup();
    expect(result.current.configured).toBe(true);
    expect(result.current.loading).toBe(true);
  });

  it('resolves to the signed-in user and ensures a profile', async () => {
    const { result } = setup();
    const cb = onAuthStateChanged.mock.calls[0][1];
    await act(async () => { cb({ uid: 'u1', displayName: 'U' }); });
    expect(result.current.user).toMatchObject({ uid: 'u1' });
    expect(result.current.loading).toBe(false);
    await waitFor(() => expect(repo.ensureProfile).toHaveBeenCalledWith({ uid: 'u1', displayName: 'U' }));
  });

  it('records an error when getRedirectResult rejects', async () => {
    getRedirectResult.mockRejectedValue({ code: 'auth/redirect-failed' });
    const { result } = setup();
    await waitFor(() => expect(result.current.error).toBe('auth/redirect-failed'));
  });

  it('signInWithGoogle uses a popup on the happy path', async () => {
    const { result } = setup();
    await act(async () => { await result.current.signInWithGoogle(); });
    expect(signInWithPopup).toHaveBeenCalled();
    expect(result.current.error).toBe(null);
  });

  it('falls back to redirect when the popup is blocked', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });
    const { result } = setup();
    await act(async () => { await result.current.signInWithGoogle(); });
    expect(signInWithRedirect).toHaveBeenCalled();
  });

  it('sets an error when the redirect fallback also fails', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });
    signInWithRedirect.mockRejectedValue({ code: 'auth/redirect-blew-up' });
    const { result } = setup();
    await act(async () => { await result.current.signInWithGoogle(); });
    expect(result.current.error).toBe('auth/redirect-blew-up');
  });

  it('silently ignores a user-cancelled popup', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    const { result } = setup();
    await act(async () => { await result.current.signInWithGoogle(); });
    expect(result.current.error).toBe(null);
    expect(signInWithRedirect).not.toHaveBeenCalled();
  });

  it('surfaces a generic Google sign-in error', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/network-request-failed' });
    const { result } = setup();
    await act(async () => { await result.current.signInWithGoogle(); });
    expect(result.current.error).toBe('auth/network-request-failed');
  });

  it('signInWithEmail returns true on success', async () => {
    const { result } = setup();
    let ok;
    await act(async () => { ok = await result.current.signInWithEmail('a@b.com', 'pw'); });
    expect(ok).toBe(true);
    expect(signInWithEmailAndPassword).toHaveBeenCalled();
  });

  it('signInWithEmail returns false and records the error on failure', async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: 'auth/wrong-password' });
    const { result } = setup();
    let ok;
    await act(async () => { ok = await result.current.signInWithEmail('a@b.com', 'pw'); });
    expect(ok).toBe(false);
    expect(result.current.error).toBe('auth/wrong-password');
  });

  it('signUpWithEmail returns true on success and false on failure', async () => {
    const { result } = setup();
    let ok;
    await act(async () => { ok = await result.current.signUpWithEmail('a@b.com', 'pw'); });
    expect(ok).toBe(true);

    createUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use' });
    await act(async () => { ok = await result.current.signUpWithEmail('a@b.com', 'pw'); });
    expect(ok).toBe(false);
    expect(result.current.error).toBe('auth/email-already-in-use');
  });

  it('signOutUser clears wt_landed_ session keys and calls signOut', async () => {
    sessionStorage.setItem('wt_landed_u1', '1');
    sessionStorage.setItem('keep_me', 'yes');
    const { result } = setup();
    await act(async () => { await result.current.signOutUser(); });
    expect(signOut).toHaveBeenCalled();
    expect(sessionStorage.getItem('wt_landed_u1')).toBe(null);
    expect(sessionStorage.getItem('keep_me')).toBe('yes');
  });

  // Errors without a `.code` must fall back to the generic labels.
  it('falls back to a generic label when getRedirectResult rejects without a code', async () => {
    getRedirectResult.mockRejectedValue({});
    const { result } = setup();
    await waitFor(() => expect(result.current.error).toBe('sign-in-failed'));
  });

  it('falls back to a generic label for a codeless popup error', async () => {
    signInWithPopup.mockRejectedValue({});
    const { result } = setup();
    await act(async () => { await result.current.signInWithGoogle(); });
    expect(result.current.error).toBe('sign-in-failed');
  });

  it('falls back to a generic label when the redirect fallback rejects without a code', async () => {
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });
    signInWithRedirect.mockRejectedValue({});
    const { result } = setup();
    await act(async () => { await result.current.signInWithGoogle(); });
    expect(result.current.error).toBe('sign-in-failed');
  });

  it('falls back to generic labels for codeless email sign-in / sign-up errors', async () => {
    signInWithEmailAndPassword.mockRejectedValue({});
    createUserWithEmailAndPassword.mockRejectedValue({});
    const { result } = setup();
    await act(async () => { await result.current.signInWithEmail('a@b.com', 'pw'); });
    expect(result.current.error).toBe('sign-in-failed');
    await act(async () => { await result.current.signUpWithEmail('a@b.com', 'pw'); });
    expect(result.current.error).toBe('sign-up-failed');
  });
});
