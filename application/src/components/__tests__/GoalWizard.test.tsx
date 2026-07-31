import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

// Spies for every write the wizard can make.
const updateProfile = vi.fn();
const createDashboard = vi.fn();
const updateDashboard = vi.fn();
const addWeight = vi.fn();
const createInvite = vi.fn();

// Fixtures the mocked read-hooks return (mutated per test).
let profileData: unknown;
let weightsData: unknown;
let dashData: unknown;

vi.mock('../../auth/useAuthedUser.js', () => ({
  useAuthedUser: () => ({ uid: 'me', displayName: 'Me', email: 'me@x.com' }),
}));
vi.mock('../../hooks/useData.js', () => ({
  useProfile: () => ({ data: profileData }),
  useWeights: () => ({ data: weightsData }),
  useDashboard: () => ({ data: dashData }),
}));
vi.mock('../../hooks/mutations.js', () => ({
  useUpdateProfile: () => ({ run: (...a: unknown[]) => updateProfile(...a), busy: false, error: null }),
  useCreateDashboard: () => ({ run: (...a: unknown[]) => createDashboard(...a), busy: false, error: null }),
  useUpdateDashboard: () => ({ run: (...a: unknown[]) => updateDashboard(...a), busy: false, error: null }),
  useAddWeight: () => ({ run: (...a: unknown[]) => addWeight(...a), busy: false, error: null }),
  useCreateInvite: () => ({ run: (...a: unknown[]) => createInvite(...a), busy: false, error: null }),
}));

import GoalWizard from '../GoalWizard.jsx';

function renderWizard(props = {}) {
  const onClose = vi.fn();
  renderWithRouter(
    <Routes>
      <Route path="/" element={<GoalWizard mode="create" onClose={onClose} {...props} />} />
      <Route path="/dashboard/:id" element={<div>DASHBOARD PAGE</div>} />
    </Routes>,
    { route: '/' },
  );
  return onClose;
}

const clickBtn = (name: RegExp) => userEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  vi.clearAllMocks();
  createDashboard.mockResolvedValue({ id: 'new-dash' });
  updateProfile.mockResolvedValue(undefined);
  updateDashboard.mockResolvedValue(undefined);
  addWeight.mockResolvedValue(undefined);
  createInvite.mockResolvedValue(undefined);
  // Complete profile → the DOB+height gate is skipped by default.
  profileData = { uid: 'me', name: 'Me', heightM: 1.8, dob: '1990-01-01' };
  weightsData = [];
  dashData = null;
});

describe('GoalWizard — create flow', () => {
  it('skips the profile gate for a complete profile and shows an honest 6-step count', () => {
    renderWizard();
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument(); // name + 5, no gate
    expect(screen.getByRole('heading', { name: 'Name your dashboard' })).toBeInTheDocument();
    expect(screen.queryByText('First, two quick details')).not.toBeInTheDocument();
  });

  it('lets a first-timer finish by accepting the suggestions, writing goal + start weigh-in', async () => {
    const onClose = renderWizard();

    await userEvent.type(screen.getByPlaceholderText(/Me & Priya/), 'Summer cut');
    await clickBtn(/continue/i); // → start date (default: today)
    await clickBtn(/continue/i); // → start weight

    await userEvent.type(screen.getByLabelText('Start weight in kg'), '88');
    await clickBtn(/continue/i); // → target

    await userEvent.type(screen.getByLabelText('Target weight in kg'), '80');
    await clickBtn(/continue/i); // → target date (safe-pace date pre-filled by effect)
    await clickBtn(/continue/i); // → review

    await clickBtn(/create dashboard/i);

    // Lands on the new dashboard once every write resolves.
    expect(await screen.findByText('DASHBOARD PAGE')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();

    expect(createDashboard).toHaveBeenCalledWith('me', { name: 'Summer cut' });
    // Start weight saved as a normal weigh-in for the start date (today).
    const today = new Date().toISOString().slice(0, 10);
    expect(addWeight).toHaveBeenCalledWith('me', { date: today, kg: 88 });
    // The goal carries startISO + target + a derived safe-pace target date.
    expect(updateDashboard).toHaveBeenCalledWith('new-dash', {
      goals: { me: expect.objectContaining({ startISO: today, targetKg: 80, targetISO: expect.any(String) }) },
    });
  });

  it('requires DOB + height when the profile is incomplete (gate is not skippable)', async () => {
    profileData = { uid: 'me', name: 'Me', heightM: null, dob: null };
    renderWizard();
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument(); // name + gate + 5

    await userEvent.type(screen.getByPlaceholderText(/Me & Priya/), 'Pair');
    await clickBtn(/continue/i); // → gate

    expect(screen.getByRole('heading', { name: 'First, two quick details' })).toBeInTheDocument();
    // Continue is blocked until both fields are provided.
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '1992-05-05' } });
    await userEvent.type(screen.getByLabelText('Height in metres'), '1.7');
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });

  it('treats an out-of-range target as guidance, never blocking Continue', async () => {
    renderWizard();
    await userEvent.type(screen.getByPlaceholderText(/Me & Priya/), 'Cut');
    await clickBtn(/continue/i); // start date
    await clickBtn(/continue/i); // start weight
    await userEvent.type(screen.getByLabelText('Start weight in kg'), '88');
    await clickBtn(/continue/i); // target

    // 45 kg at height 1.8 m is below the healthy band (≈60–81) → a warning…
    await userEvent.type(screen.getByLabelText('Target weight in kg'), '45');
    expect(screen.getByText(/underweight territory/)).toBeInTheDocument();
    // …but the user is never blocked by a warning.
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
  });
});
