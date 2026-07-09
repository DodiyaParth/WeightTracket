import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

const setHabitMark = vi.fn();
const updateDashboard = vi.fn();
vi.mock('../../data/repo.js', () => ({
  repo: {
    setHabitMark: (...a) => setHabitMark(...a),
    updateDashboard: (...a) => updateDashboard(...a),
  },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import HabitsSection from '../HabitsSection.jsx';
import { todayISO } from '../../lib/date.js';

const members = [{ uid: 'parth', name: 'Parth', color: '#1' }, { uid: 'priya', name: 'Priya', color: '#2' }];
const baseDashboard = {
  id: 'd1', teamGoal: { label: 'Lose 15 together' },
  habits: [{ id: 'h1', label: '10k steps', emoji: '🚶' }, { id: 'h2', label: 'No sugar', emoji: '🍬' }],
};
const logs = { parth: { h1: { [todayISO()]: 1 } }, priya: { h1: { [todayISO()]: 1 } } };

function renderHabits(overrides = {}) {
  const props = { dashboard: baseDashboard, members, logs, meUid: 'parth', readOnly: false, ...overrides };
  return renderWithRouter(<HabitsSection {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  setHabitMark.mockResolvedValue();
  updateDashboard.mockResolvedValue();
});

describe('HabitsSection - checklist', () => {
  it('renders the checklist, streak grid, habits and done count', () => {
    renderHabits();
    expect(screen.getByText('Daily habits')).toBeInTheDocument();
    expect(screen.getByText('My checklist')).toBeInTheDocument();
    expect(screen.getByText('Streak grid')).toBeInTheDocument();
    expect(screen.getAllByText('10k steps').length).toBeGreaterThan(0);
    expect(screen.getByText('1/2 done')).toBeInTheDocument();
  });

  it('toggles a habit check on and off', async () => {
    renderHabits();
    await userEvent.click(screen.getByRole('button', { name: '10k steps' }));
    expect(setHabitMark).toHaveBeenCalledWith('d1', 'parth', 'h1', todayISO(), 0);
    await userEvent.click(screen.getByRole('button', { name: 'No sugar' }));
    expect(setHabitMark).toHaveBeenCalledWith('d1', 'parth', 'h2', todayISO(), 1);
  });

  it('shows an inline error when a toggle fails', async () => {
    setHabitMark.mockRejectedValueOnce(new Error('nope'));
    renderHabits();
    await userEvent.click(screen.getByRole('button', { name: '10k steps' }));
    expect(await screen.findByText(/couldn.t save/i)).toBeInTheDocument();
  });

  it('steps through days', async () => {
    renderHabits();
    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
  });

  it('renames a habit', async () => {
    renderHabits();
    await userEvent.click(screen.getByRole('button', { name: 'Rename 10k steps' }));
    const input = screen.getByDisplayValue('10k steps');
    await userEvent.clear(input);
    await userEvent.type(input, '12k steps{Enter}');
    expect(updateDashboard).toHaveBeenCalled();
  });

  it('deletes a habit after confirmation', async () => {
    renderHabits();
    await userEvent.click(screen.getByRole('button', { name: 'Delete 10k steps' }));
    expect(screen.getByText('Delete this habit?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(updateDashboard).toHaveBeenCalled();
  });

  it('adds a habit', async () => {
    renderHabits();
    await userEvent.click(screen.getByRole('button', { name: /add habit/i }));
    const input = screen.getByPlaceholderText(/new habit/i);
    await userEvent.type(input, 'Meditate');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(updateDashboard).toHaveBeenCalled();
  });

  it('shows empty messaging when there are no habits', () => {
    renderHabits({ dashboard: { ...baseDashboard, habits: [] } });
    expect(screen.getByText(/no habits yet/i)).toBeInTheDocument();
    expect(screen.getByText(/add a habit to start building streaks/i)).toBeInTheDocument();
  });
});

describe('HabitsSection - streak grid', () => {
  it('switches scope to a member and toggles a day cell', async () => {
    renderHabits();
    // Streak grid scope buttons: All / Parth / Priya
    await userEvent.click(screen.getByRole('button', { name: 'Parth' }));
    // Now cells for the signed-in user are editable buttons (aria-label = date)
    const cell = screen.getAllByRole('button', { name: todayISO() })[0];
    fireEvent.click(cell);
    expect(setHabitMark).toHaveBeenCalled();
  });

  it('switches the span between Week and Month', async () => {
    renderHabits();
    await userEvent.click(screen.getByRole('button', { name: 'Week' }));
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(screen.getByText('Streak grid')).toBeInTheDocument();
  });
});

describe('HabitsSection - read only', () => {
  it('hides editing affordances and titles the checklist with the person name', () => {
    renderHabits({ readOnly: true });
    expect(screen.getByText("Parth’s checklist")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add habit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename 10k steps' })).not.toBeInTheDocument();
  });
});
