import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

let authValue: { user: unknown };
vi.mock('../AuthContext.jsx', () => ({ useAuth: () => authValue }));

import { useAuthedUser } from '../useAuthedUser.js';

describe('useAuthedUser', () => {
  it('returns the signed-in user when present', () => {
    authValue = { user: { uid: 'parth' } };
    const { result } = renderHook(() => useAuthedUser());
    expect(result.current).toEqual({ uid: 'parth' });
  });

  it('throws when used without a signed-in user (misuse outside ProtectedRoute)', () => {
    authValue = { user: null };
    // React re-dispatches the render error as a window "error" event in dev;
    // swallow it so the thrown assertion below is the only failure surface.
    const onError = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener('error', onError);
    expect(() => renderHook(() => useAuthedUser())).toThrow(/ProtectedRoute/);
    window.removeEventListener('error', onError);
  });
});
