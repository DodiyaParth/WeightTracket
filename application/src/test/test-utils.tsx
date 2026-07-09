import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Render a component inside a router. Pass `route` to control the initial URL
// (handy for pages/components that read useLocation/useParams).
export function renderWithRouter(ui, { route = '/', ...opts } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>, opts);
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

export * from '@testing-library/react';
// Re-export directly from the source module. A local `import ... ; export { userEvent }`
// round-trip resolves to undefined under Vite's CJS/ESM interop here.
export { userEvent } from '@testing-library/user-event';
