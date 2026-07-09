import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext.jsx';

// In tests Firebase is forced unconfigured (see vite.config.js test.env), so
// the provider resolves immediately and the sign-in methods short-circuit
// instead of hitting a real backend.
describe('AuthContext (Firebase unconfigured)', () => {
  it('exposes resolved, signed-out, unconfigured state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.configured).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBe(null);
  });

  it('signInWithEmail returns false and reports not-configured', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    let ok;
    await act(async () => {
      ok = await result.current.signInWithEmail('a@b.com', 'pw');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('not-configured');
  });

  it('signUpWithEmail short-circuits and signOutUser is a no-op when unconfigured', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    let ok;
    await act(async () => { ok = await result.current.signUpWithEmail('a@b.com', 'pw'); });
    expect(ok).toBe(false);
    expect(result.current.error).toBe('not-configured');
    await act(async () => { await result.current.signOutUser(); }); // returns early, no throw
  });

  it('useAuth throws when used outside an AuthProvider', () => {
    // React re-dispatches the render error as a window "error" event in dev;
    // swallow both that and its console.error so the run stays quiet.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = (e) => e.preventDefault();
    window.addEventListener('error', onError);
    expect(() => renderHook(() => useAuth())).toThrow(/within an AuthProvider/);
    window.removeEventListener('error', onError);
    errSpy.mockRestore();
  });
});
