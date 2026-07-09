import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

const updateDashboard = vi.fn();
vi.mock('../../data/repo.js', () => ({
  repo: { updateDashboard: (...a) => updateDashboard(...a) },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import GoalEditor from '../GoalEditor.jsx';

const dashboard = {
  id: 'd1', name: 'Parth & Priya', ownerUid: 'parth',
  members: { parth: { uid: 'parth', role: 'owner', joinedAt: 1 }, priya: { uid: 'priya', role: 'editor', joinedAt: 2 } },
  trackedUids: ['parth', 'priya'],
  goals: { parth: { targetKg: 80, targetISO: '2026-09-30' } },
  teamGoal: { label: 'Lose 15 kg together', target: 15 },
};
const profiles = {
  parth: { uid: 'parth', name: 'Parth', heightM: 1.78 },
  priya: { uid: 'priya', name: 'Priya', heightM: 1.63 },
};
const series = {
  parth: [{ date: '2026-01-01', kg: 88 }, { date: '2026-02-01', kg: 85 }],
  priya: [{ date: '2026-01-01', kg: 72 }],
};

function renderEditor(onClose = vi.fn()) {
  renderWithRouter(<GoalEditor dashboard={dashboard} series={series} profiles={profiles} onClose={onClose} />);
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateDashboard.mockResolvedValue();
});

describe('GoalEditor', () => {
  it('renders per-person goals and the existing team goal', () => {
    renderEditor();
    expect(screen.getByText('Edit goals')).toBeInTheDocument();
    expect(screen.getByText('Parth')).toBeInTheDocument();
    expect(screen.getByText('Priya')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lose 15 kg together')).toBeInTheDocument();
    expect(screen.getAllByText('Target weight (kg)').length).toBe(2);
  });

  it('saves goals and closes when the team label is kept', async () => {
    const onClose = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Save goals' }));
    expect(updateDashboard).toHaveBeenCalledWith('d1', expect.objectContaining({
      teamGoal: { label: 'Lose 15 kg together', target: 15 },
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('confirms before removing an existing team goal', async () => {
    const onClose = renderEditor();
    const teamLabel = screen.getByDisplayValue('Lose 15 kg together');
    await userEvent.clear(teamLabel);
    await userEvent.click(screen.getByRole('button', { name: 'Save goals' }));

    expect(screen.getByText('Remove the team goal?')).toBeInTheDocument();
    expect(updateDashboard).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(updateDashboard).toHaveBeenCalledWith('d1', expect.objectContaining({ teamGoal: null }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an error and stays open when the save fails', async () => {
    updateDashboard.mockRejectedValue(new Error('Save failed'));
    const onClose = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Save goals' }));
    expect(await screen.findByText('Save failed')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lets a person set and remove a target date', async () => {
    renderEditor();
    // Priya has no date yet -> a "No date set" button
    fireEvent.click(screen.getByRole('button', { name: /no date set/i }));
    // Parth already has a date -> can remove it
    const removeButtons = screen.getAllByRole('button', { name: 'Remove date' });
    expect(removeButtons.length).toBeGreaterThan(0);
    fireEvent.click(removeButtons[0]);
  });
});
