import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter } from '../../test/test-utils.jsx';

let authState;
vi.mock('../AuthContext.jsx', () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }) => children,
}));

// Keep the gate isolated from QuickLog's real (repo-backed) provider.
vi.mock('../../components/QuickLog.jsx', () => ({
  QuickLogProvider: ({ children }) => <div data-testid="quicklog">{children}</div>,
}));

vi.mock('../../components/Splash.jsx', () => ({
  default: () => <div>splash-screen</div>,
}));

import ProtectedRoute from '../ProtectedRoute.jsx';

beforeEach(() => { authState = { user: null, loading: false }; });

function renderGate(route = '/private') {
  return renderWithRouter(
    <Routes>
      <Route path="/login" element={<div>login-page</div>} />
      <Route path="/private" element={<ProtectedRoute><div>secret</div></ProtectedRoute>} />
    </Routes>,
    { route }
  );
}

describe('ProtectedRoute', () => {
  it('shows the splash while auth is still resolving', () => {
    authState = { user: null, loading: true };
    renderGate();
    expect(screen.getByText('splash-screen')).toBeInTheDocument();
  });

  it('redirects to /login when there is no user', () => {
    authState = { user: null, loading: false };
    renderGate();
    expect(screen.getByText('login-page')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders the protected children inside the QuickLog provider when signed in', () => {
    authState = { user: { uid: 'u1' }, loading: false };
    renderGate();
    expect(screen.getByTestId('quicklog')).toBeInTheDocument();
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
