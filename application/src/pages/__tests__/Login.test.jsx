import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter, userEvent, mockAuth } from '../../test/test-utils.jsx';

let authValue;
vi.mock('../../auth/AuthContext.jsx', () => ({ useAuth: () => authValue }));

import Login from '../Login.jsx';

function renderLogin(route = '/login') {
  return renderWithRouter(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<div>HOME</div>} />
    </Routes>,
    { route }
  );
}

beforeEach(() => {
  authValue = mockAuth({ configured: true });
});

describe('Login', () => {
  it('shows a splash while auth is resolving', () => {
    authValue = mockAuth({ loading: true });
    renderLogin();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('redirects to home when already signed in', () => {
    authValue = mockAuth({ user: { uid: 'u1' } });
    renderLogin();
    expect(screen.getByText('HOME')).toBeInTheDocument();
  });

  it('warns and disables inputs when Firebase is not configured', () => {
    authValue = mockAuth({ configured: false });
    renderLogin();
    expect(screen.getByText(/isn.t configured yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeDisabled();
  });

  it('signs in with Google', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(authValue.signInWithGoogle).toHaveBeenCalled();
  });

  it('signs in with email + password', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText('Email'), '  a@b.com  ');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(authValue.signInWithEmail).toHaveBeenCalledWith('a@b.com', 'secret');
  });

  it('switches to sign-up mode and creates an account', async () => {
    renderLogin();
    await userEvent.click(screen.getByRole('button', { name: /new here/i }));
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(authValue.signUpWithEmail).toHaveBeenCalledWith('a@b.com', 'secret1');
  });

  it('maps an auth error code to friendly copy', () => {
    authValue = mockAuth({ configured: true, error: 'auth/wrong-password' });
    renderLogin();
    expect(screen.getByText('Wrong email or password.')).toBeInTheDocument();
  });
});
