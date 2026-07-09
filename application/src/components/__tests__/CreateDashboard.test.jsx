import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

vi.mock('../../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { uid: 'parth', displayName: 'Parth' } }),
}));

const createDashboard = vi.fn();
const createInvite = vi.fn();
vi.mock('../../data/repo.js', () => ({
  repo: {
    createDashboard: (...a) => createDashboard(...a),
    createInvite: (...a) => createInvite(...a),
  },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import CreateDashboard from '../CreateDashboard.jsx';

function renderModal(onClose = vi.fn()) {
  renderWithRouter(
    <Routes>
      <Route path="/" element={<CreateDashboard onClose={onClose} />} />
      <Route path="/dashboard/:id" element={<div>DASHBOARD PAGE</div>} />
    </Routes>,
    { route: '/' }
  );
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
  createDashboard.mockResolvedValue({ id: 'new-dash' });
  createInvite.mockResolvedValue({});
});

describe('CreateDashboard', () => {
  it('disables Create until a name is entered', async () => {
    renderModal();
    const createBtn = screen.getByRole('button', { name: /create/i });
    expect(createBtn).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('e.g. Parth & Priya'), 'Team Alpha');
    expect(createBtn).toBeEnabled();
  });

  it('creates a dashboard and navigates to it', async () => {
    const onClose = renderModal();
    await userEvent.type(screen.getByPlaceholderText('e.g. Parth & Priya'), 'Team Alpha');
    await userEvent.type(screen.getByPlaceholderText('e.g. Lose 15 kg together'), 'Lose 10');
    await userEvent.type(screen.getByPlaceholderText('15'), '10');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(createDashboard).toHaveBeenCalledWith('parth', { name: 'Team Alpha', teamGoalLabel: 'Lose 10', teamGoalTarget: '10' });
    expect(onClose).toHaveBeenCalled();
    expect(await screen.findByText('DASHBOARD PAGE')).toBeInTheDocument();
  });

  it('reveals the invite fields and sends an invite alongside creation', async () => {
    renderModal();
    await userEvent.type(screen.getByPlaceholderText('e.g. Parth & Priya'), 'Team Alpha');
    await userEvent.click(screen.getByRole('button', { name: /invite someone/i }));
    await userEvent.type(screen.getByPlaceholderText('name@email.com'), 'friend@x.com');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(createInvite).toHaveBeenCalledWith('new-dash', expect.objectContaining({ toEmail: 'friend@x.com', role: 'editor' }));
  });

  it('cancels without creating', async () => {
    const onClose = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(createDashboard).not.toHaveBeenCalled();
  });
});
