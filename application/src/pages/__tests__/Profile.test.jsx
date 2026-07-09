import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

vi.mock('../../components/Layout.jsx', () => ({
  default: ({ title, children }) => <div><h1>{title}</h1>{children}</div>,
}));

let authValue;
let profileData;
vi.mock('../../auth/AuthContext.jsx', () => ({ useAuth: () => authValue }));
vi.mock('../../hooks/useData.js', () => ({ useProfile: () => ({ data: profileData }) }));

const updateProfile = vi.fn();
vi.mock('../../data/repo.js', () => ({
  repo: { updateProfile: (...a) => updateProfile(...a) },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import Profile from '../Profile.jsx';

beforeEach(() => {
  vi.clearAllMocks();
  authValue = {
    user: { uid: 'parth', email: 'p@x.com', displayName: 'Parth', providerData: [{ providerId: 'google.com' }] },
    signOutUser: vi.fn(),
  };
  profileData = { uid: 'parth', name: 'Parth', heightM: 1.78 };
  updateProfile.mockResolvedValue();
});

describe('Profile', () => {
  it('renders the profile with the Google sign-in note and prefilled fields', () => {
    renderWithRouter(<Profile />);
    expect(screen.getByText('Profile & settings')).toBeInTheDocument();
    expect(screen.getByText(/signed in with Google/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Parth')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.78')).toBeInTheDocument();
  });

  it('notes email sign-in when not a Google account', () => {
    authValue.user.providerData = [{ providerId: 'password' }];
    renderWithRouter(<Profile />);
    expect(screen.getByText(/signed in with email/)).toBeInTheDocument();
  });

  it('saves changes and shows a toast', async () => {
    renderWithRouter(<Profile />);
    const name = screen.getByDisplayValue('Parth');
    await userEvent.clear(name);
    await userEvent.type(name, 'Parth D');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(updateProfile).toHaveBeenCalledWith('parth', { name: 'Parth D', heightM: 1.78 });
    expect(await screen.findByText('Profile saved')).toBeInTheDocument();
  });

  it('surfaces a save error', async () => {
    updateProfile.mockRejectedValue(new Error('Save blew up'));
    renderWithRouter(<Profile />);
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Save blew up')).toBeInTheDocument();
  });

  it('signs out from the account section', async () => {
    renderWithRouter(<Profile />);
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(authValue.signOutUser).toHaveBeenCalled();
  });
});
