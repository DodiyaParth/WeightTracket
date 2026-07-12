import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
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
import { todayISO, addDays } from '../../lib/date.js';
import { GRACE } from '../../lib/habits.js';

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
    await waitFor(() => expect(setHabitMark).toHaveBeenCalled());
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

// ---- Branch-focused scenarios --------------------------------------------
describe('HabitsSection - branch coverage', () => {
  it('falls back to defaults with no habits, no team goal, no logs, unknown me', () => {
    renderHabits({ dashboard: { id: 'd9' }, members: [], meUid: 'ghost', logs: {} });
    expect(screen.getByText('Daily behaviors toward your goal')).toBeInTheDocument();
    expect(screen.getByText(/no habits yet/i)).toBeInTheDocument();
  });

  it('closing a rename with an empty label does not save', async () => {
    renderHabits();
    await userEvent.click(screen.getByRole('button', { name: 'Rename 10k steps' }));
    const input = screen.getByDisplayValue('10k steps');
    await userEvent.clear(input);
    await userEvent.type(input, '{Enter}');
    expect(updateDashboard).not.toHaveBeenCalled();
  });

  it('cancels a rename with Escape', async () => {
    renderHabits();
    await userEvent.click(screen.getByRole('button', { name: 'Rename No sugar' }));
    const input = screen.getByDisplayValue('No sugar');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByDisplayValue('No sugar')).not.toBeInTheDocument();
  });

  it('surfaces a rename error inline', async () => {
    updateDashboard.mockRejectedValueOnce(new Error('rename failed'));
    renderHabits();
    await userEvent.click(screen.getByRole('button', { name: 'Rename 10k steps' }));
    const input = screen.getByDisplayValue('10k steps');
    await userEvent.clear(input);
    await userEvent.type(input, '12k steps{Enter}');
    expect(await screen.findByText('rename failed')).toBeInTheDocument();
  });

  it('renders grace days and a repaired streak, in All and per-member scope', async () => {
    const graceLogs = {
      parth: { h1: { [addDays(todayISO(), -2)]: 1, [addDays(todayISO(), -1)]: GRACE, [todayISO()]: 1 } },
      priya: {},
    };
    renderHabits({ logs: graceLogs });
    // checklist shows the repaired marker
    expect(screen.getAllByText(/repaired/).length).toBeGreaterThan(0);
    // per-member scope path (cellKind scope !== 'all')
    await userEvent.click(screen.getByRole('button', { name: 'Parth' }));
    expect(screen.getByText('streak repaired')).toBeInTheDocument();
  });

  it('toggles a previously-unmarked grid cell to done (1)', async () => {
    renderHabits();
    await userEvent.click(screen.getByRole('button', { name: 'Parth' }));
    const blank = addDays(todayISO(), -5);
    fireEvent.click(screen.getAllByRole('button', { name: blank })[0]);
    await waitFor(() => expect(setHabitMark).toHaveBeenCalledWith('d1', 'parth', 'h1', blank, 1));
  });

  it('shows a grid save error when a cell toggle fails', async () => {
    setHabitMark.mockRejectedValueOnce(new Error('nope'));
    renderHabits();
    await userEvent.click(screen.getByRole('button', { name: 'Parth' }));
    fireEvent.click(screen.getAllByRole('button', { name: todayISO() })[0]);
    expect(await screen.findByText(/couldn.t save that day/i)).toBeInTheDocument();
  });

  it('add-habit: empty closes, Enter adds, and errors surface', async () => {
    updateDashboard.mockRejectedValueOnce(new Error('add failed'));
    renderHabits();
    // Enter with an empty field just closes the composer
    await userEvent.click(screen.getByRole('button', { name: /add habit/i }));
    await userEvent.type(screen.getByPlaceholderText(/new habit/i), '{Enter}');
    expect(updateDashboard).not.toHaveBeenCalled();

    // reopen, add via Enter → rejected → error visible
    await userEvent.click(screen.getByRole('button', { name: /add habit/i }));
    await userEvent.type(screen.getByPlaceholderText(/new habit/i), 'Meditate{Enter}');
    expect(await screen.findByText('add failed')).toBeInTheDocument();
  });
});
