import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

const updateDashboard = vi.fn();
const deleteDashboard = vi.fn();
const removeMember = vi.fn();
vi.mock('../../data/repo.js', () => ({
  repo: {
    updateDashboard: (...a) => updateDashboard(...a),
    deleteDashboard: (...a) => deleteDashboard(...a),
    removeMember: (...a) => removeMember(...a),
  },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import DashSettings from '../DashSettings.jsx';

const dashboard = {
  id: 'd1', name: 'Parth & Priya', ownerUid: 'parth',
  members: { parth: { uid: 'parth', role: 'owner', joinedAt: 1 }, priya: { uid: 'priya', role: 'editor', joinedAt: 2 } },
  trackedUids: ['parth', 'priya'],
};
const profiles = {
  parth: { uid: 'parth', name: 'Parth', heightM: 1.78 },
  priya: { uid: 'priya', name: 'Priya', heightM: 1.63 },
};

function renderSettings(props = {}) {
  const onClose = props.onClose || vi.fn();
  const onEditGoals = props.onEditGoals || vi.fn();
  const onManageSharing = props.onManageSharing || vi.fn();
  renderWithRouter(
    <Routes>
      <Route path="/dash" element={
        <DashSettings dashboard={dashboard} profiles={profiles} meUid={props.meUid || 'parth'}
          onClose={onClose} onEditGoals={onEditGoals} onManageSharing={onManageSharing} />
      } />
      <Route path="/" element={<div>HOME</div>} />
    </Routes>,
    { route: '/dash' }
  );
  return { onClose, onEditGoals, onManageSharing };
}

beforeEach(() => {
  vi.clearAllMocks();
  updateDashboard.mockResolvedValue();
  deleteDashboard.mockResolvedValue();
  removeMember.mockResolvedValue();
});

describe('DashSettings', () => {
  it('renders the settings, members, layer toggles and forwards goal/sharing actions', async () => {
    const { onEditGoals, onManageSharing } = renderSettings();
    expect(screen.getByText('Dashboard settings')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Parth & Priya')).toBeInTheDocument();
    expect(screen.getByText('Raw daily')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /edit goals/i }));
    await userEvent.click(screen.getByRole('button', { name: /manage sharing/i }));
    expect(onEditGoals).toHaveBeenCalled();
    expect(onManageSharing).toHaveBeenCalled();
  });

  it('toggles a chart layer and a person before saving', async () => {
    const { onClose } = renderSettings();
    await userEvent.click(screen.getByRole('button', { name: /raw daily/i }));
    await userEvent.click(screen.getByRole('switch', { name: /show priya/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(updateDashboard).toHaveBeenCalledWith('d1', expect.objectContaining({ name: 'Parth & Priya' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('lets the owner delete the dashboard and navigates home', async () => {
    renderSettings({ meUid: 'parth' });
    await userEvent.click(screen.getByRole('button', { name: /delete dashboard/i }));
    expect(screen.getByText('Delete this dashboard?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteDashboard).toHaveBeenCalledWith('d1');
    expect(await screen.findByText('HOME')).toBeInTheDocument();
  });

  it('lets a non-owner leave the dashboard', async () => {
    renderSettings({ meUid: 'priya' });
    await userEvent.click(screen.getByRole('button', { name: /leave dashboard/i }));
    expect(screen.getByText('Leave this dashboard?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(removeMember).toHaveBeenCalledWith('d1', 'priya');
  });

  it('shows an error and stays open when saving fails', async () => {
    updateDashboard.mockRejectedValue(new Error('Nope'));
    const { onClose } = renderSettings();
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Nope')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
