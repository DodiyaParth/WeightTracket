import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, vi } from 'vitest';

// Render a component inside a router and a fresh QueryClient (mutation hooks
// in hooks/mutations.js need one; retry:false matches main.tsx and keeps
// rejected-mutation tests from waiting through retry backoff). A new client
// per call means no cache bleed between tests. Pass `route` to control the
// initial URL (handy for pages/components that read useLocation/useParams).
//
// Providers go through RTL's `wrapper` option rather than wrapping `ui`
// directly — `wrapper` is re-applied on every `rerender()` call too, so a
// test that calls `rerender(<Foo />)` doesn't drop the router/query-client
// context (wrapping `ui` inline would only wrap the *first* render).
export function renderWithRouter(ui, { route = '/', ...opts } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...opts });
}

// A default auth-context value. Pair with `vi.mock('../auth/AuthContext.jsx')`
// in tests that need a signed-in user or specific auth state, e.g.:
//   vi.mock('../../auth/AuthContext.jsx', () => ({
//     useAuth: () => mockAuth({ user: { uid: 'u1' } }),
//     AuthProvider: ({ children }) => children,
//   }));
export const mockAuth = (overrides = {}) => ({
  user: null,
  loading: false,
  error: null,
  configured: false,
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  signOutUser: vi.fn(),
  ...overrides,
});

// A controllable stand-in for window.matchMedia, for tests that touch
// useIsMobile()/responsive UI. test/setup.ts installs a fixed
// (matches: false) stub globally — this swaps it out for the duration of one
// test and restores the original via `afterEach`, so later tests keep
// getting the desktop-default stub. Call `.change(matches)` on the return
// value to simulate a viewport resize/rotation.
export function mockMatchMedia(matches, query = '(max-width: 768px)') {
  let current = matches;
  const listeners = [];
  const mql = {
    get matches() {
      return current;
    },
    media: query,
    onchange: null,
    addEventListener: (_type, cb) => listeners.push(cb),
    removeEventListener: (_type, cb) => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
    addListener: (cb) => listeners.push(cb),
    removeListener: (cb) => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
    dispatchEvent: () => false,
    change(next) {
      current = next;
      listeners.forEach((cb) => cb({ matches: next }));
    },
  };

  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockReturnValue(mql);
  afterEach(() => {
    window.matchMedia = original;
  });

  return mql;
}

// Convenience wrappers for the common case of "render this once at a fixed
// viewport class" — most Layout/drawer tests don't need to simulate a resize
// mid-test, so they just want the mobile or desktop matchMedia answer from
// the very first render.
export function renderMobile(ui, opts = {}) {
  mockMatchMedia(true);
  return renderWithRouter(ui, opts);
}

export function renderDesktop(ui, opts = {}) {
  mockMatchMedia(false);
  return renderWithRouter(ui, opts);
}

export * from '@testing-library/react';
// Re-export directly from the source module. A local `import ... ; export { userEvent }`
// round-trip resolves to undefined under Vite's CJS/ESM interop here.
export { userEvent } from '@testing-library/user-event';
