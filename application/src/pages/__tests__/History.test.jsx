import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';
import { todayISO, addDays } from '../../lib/date.js';

vi.mock('../../components/Layout.jsx', () => ({
  default: ({ title, children }) => <div><h1>{title}</h1>{children}</div>,
}));

let quick;
let weightsState;
vi.mock('../../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: { uid: 'parth' } }) }));
vi.mock('../../components/QuickLog.jsx', () => ({ useQuickLog: () => quick }));
vi.mock('../../hooks/useData.js', () => ({ useWeights: () => weightsState }));

const deleteWeight = vi.fn();
vi.mock('../../data/repo.js', () => ({
  repo: { deleteWeight: (...a) => deleteWeight(...a) },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import History from '../History.jsx';

const entries = [
  { id: 'w1', date: todayISO(), kg: 80, note: 'am' },
  { id: 'w2', date: addDays(todayISO(), -40), kg: 81, note: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  quick = { open: vi.fn() };
  weightsState = { data: entries, loading: false, error: null, reload: vi.fn() };
  deleteWeight.mockResolvedValue();
});

describe('History list view', () => {
  it('renders entries grouped by month and opens edit', async () => {
    renderWithRouter(<History />);
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getAllByText(/kg$/).length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole('button', { name: /^Edit entry on/ })[0]);
    expect(quick.open).toHaveBeenCalledWith(entries[0]);
  });

  it('deletes an entry after confirmation', async () => {
    renderWithRouter(<History />);
    await userEvent.click(screen.getAllByRole('button', { name: /^Delete entry on/ })[0]);
    expect(screen.getByText('Delete this entry?')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(deleteWeight).toHaveBeenCalledWith('parth', 'w1');
  });

  it('shows an empty message with no entries', () => {
    weightsState = { data: [], loading: false, error: null, reload: vi.fn() };
    renderWithRouter(<History />);
    expect(screen.getByText(/No entries yet/)).toBeInTheDocument();
  });

  it('shows a skeleton while loading and a retry card on error', () => {
    weightsState = { data: undefined, loading: true, error: null, reload: vi.fn() };
    const { rerender } = renderWithRouter(<History />);
    // switch to error state
    weightsState = { data: undefined, loading: false, error: new Error('x'), reload: vi.fn() };
    rerender(<History />);
    expect(screen.getByText('Couldn’t load your history')).toBeInTheDocument();
  });
});

describe('History calendar view', () => {
  it('switches to calendar, navigates months, and opens days', async () => {
    renderWithRouter(<History />);
    await userEvent.click(screen.getByRole('radio', { name: 'Calendar' }));

    // an existing entry day opens the entry; an empty past day opens a prefilled add
    const entryDay = screen.getByRole('button', { name: /— edit$/ });
    await userEvent.click(entryDay);
    expect(quick.open).toHaveBeenCalledWith(entries[0]);

    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    const addDayButtons = screen.getAllByRole('button', { name: /add a weigh-in$/ });
    await userEvent.click(addDayButtons[0]);
    expect(quick.open).toHaveBeenCalledWith(expect.objectContaining({ date: expect.any(String) }));
  });
});
