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
  it('renders per-person goals (no manual team-goal input — it is derived)', () => {
    renderEditor();
    expect(screen.getByText('Edit goals')).toBeInTheDocument();
    expect(screen.getByText('Parth')).toBeInTheDocument();
    expect(screen.getByText('Priya')).toBeInTheDocument();
    expect(screen.getAllByText('Target weight (kg)').length).toBe(2);
    // The old manual "Shared team goal" input is gone.
    expect(screen.queryByText('Shared team goal')).not.toBeInTheDocument();
  });

  it('saves only per-person goals (no teamGoal) and closes', async () => {
    const onClose = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Save goals' }));
    expect(updateDashboard).toHaveBeenCalledWith('d1', { goals: { parth: { targetKg: 80, targetISO: '2026-09-30' } } });
    // never writes a teamGoal field
    expect(updateDashboard.mock.calls[0][1]).not.toHaveProperty('teamGoal');
    expect(onClose).toHaveBeenCalled();
  });

  it('preserves a goal’s startISO when only its target is edited', async () => {
    const dash = { ...dashboard, goals: { parth: { startISO: '2026-01-01', targetKg: 80, targetISO: '2026-09-30' } } };
    renderWithRouter(<GoalEditor dashboard={dash} series={series} profiles={profiles} onClose={vi.fn()} />);
    const targetInput = screen.getByDisplayValue('80');
    await userEvent.clear(targetInput);
    await userEvent.type(targetInput, '78');
    await userEvent.click(screen.getByRole('button', { name: 'Save goals' }));
    expect(updateDashboard).toHaveBeenCalledWith('d1', { goals: { parth: { startISO: '2026-01-01', targetKg: 78, targetISO: '2026-09-30' } } });
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

  it('renders a member with no current weight', () => {
    const noGoals = { ...dashboard, goals: {} };
    // series omitted → currentWeight falls back to [] and current shows as a dash
    renderWithRouter(<GoalEditor dashboard={noGoals} profiles={profiles} onClose={vi.fn()} />);
    expect(screen.getAllByText((_, el) => el?.textContent === 'now —').length).toBeGreaterThan(0);
  });

  it('edits a target weight and then clears it', async () => {
    renderEditor();
    const targetInput = screen.getByDisplayValue('80'); // Parth's target
    await userEvent.clear(targetInput);
    expect(targetInput).toHaveValue('');
    await userEvent.type(targetInput, '68');
    expect(targetInput).toHaveValue('68');
  });
});
