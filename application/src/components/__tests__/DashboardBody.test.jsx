import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

let quick;
const addNsv = vi.fn();
const deleteNsv = vi.fn();

vi.mock('../Chart.jsx', () => ({ default: () => <div>CHART</div> }));
vi.mock('../HabitsSection.jsx', () => ({ default: () => <div>HABITS</div> }));
vi.mock('../MotivationCard.jsx', () => ({ default: ({ person }) => <div>MOTIV {person?.name}</div> }));
vi.mock('../QuickLog.jsx', () => ({ useQuickLog: () => quick }));
vi.mock('../../data/repo.js', () => ({
  repo: { addNsv: (...a) => addNsv(...a), deleteNsv: (...a) => deleteNsv(...a) },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import DashboardBody from '../DashboardBody.jsx';

function makeSeries(start, n) {
  const out = [];
  const base = Date.UTC(2026, 0, 1);
  for (let i = 0; i < n; i++) {
    const date = new Date(base + i * 86400000).toISOString().slice(0, 10);
    out.push({ id: `${date}`, date, kg: +(start - i * 0.1).toFixed(1), note: '' });
  }
  return out;
}

const dashboard = {
  id: 'd1', name: 'Parth & Priya', ownerUid: 'parth',
  members: { parth: { uid: 'parth', role: 'owner', joinedAt: 1 }, priya: { uid: 'priya', role: 'editor', joinedAt: 2 } },
  trackedUids: ['parth', 'priya'],
  goals: { parth: { startKg: 88, targetKg: 80, targetISO: '2026-12-31' } },
  teamGoal: { label: 'Lose 15 together', target: 15 },
  habits: [],
};
const profiles = {
  parth: { uid: 'parth', name: 'Parth', heightM: 1.78 },
  priya: { uid: 'priya', name: 'Priya', heightM: null },
};
const series = { parth: makeSeries(88, 30), priya: makeSeries(72, 20) };
const nsv = { parth: [{ id: 'n1', date: '2026-01-20', text: 'Jeans looser' }] };

function renderBody(overrides = {}) {
  const props = {
    dashboard, series, habitLogs: {}, nsv, meUid: 'parth', readOnly: false, onEditGoals: vi.fn(), profiles,
    ...overrides,
  };
  renderWithRouter(<DashboardBody {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
  quick = { open: vi.fn() };
  addNsv.mockResolvedValue();
  deleteNsv.mockResolvedValue();
});

describe('DashboardBody', () => {
  it('renders the full dashboard with stats, goals, motivation, BMI and wins', () => {
    renderBody();
    expect(screen.getByText(/Showing Parth’s stats/)).toBeInTheDocument();
    expect(screen.getByText('Current weight')).toBeInTheDocument();
    expect(screen.getByText('Progress & prediction')).toBeInTheDocument();
    expect(screen.getByText('MOTIV Parth')).toBeInTheDocument();
    expect(screen.getByText('BMI & healthy range')).toBeInTheDocument();
    expect(screen.getByText('Wins this month')).toBeInTheDocument();
    expect(screen.getByText('CHART')).toBeInTheDocument();
    expect(screen.getByText('HABITS')).toBeInTheDocument();
    // priya has no goal and no height -> the two "missing" branches render
    expect(screen.getByText('No goal set')).toBeInTheDocument();
    expect(screen.getByText(/Add height in Profile/)).toBeInTheDocument();
  });

  it('switches the focused person', async () => {
    renderBody();
    await userEvent.click(screen.getByRole('button', { name: /Priya/ }));
    expect(screen.getByText(/Showing Priya’s stats/)).toBeInTheDocument();
  });

  it('adds a win', async () => {
    renderBody();
    await userEvent.click(screen.getByRole('button', { name: /^Add$/i }));
    const input = screen.getByPlaceholderText(/rings feel looser/i);
    await userEvent.type(input, 'Slept great');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(addNsv).toHaveBeenCalledWith('d1', 'parth', expect.objectContaining({ text: 'Slept great' }));
  });

  it('deletes a win after confirmation', async () => {
    renderBody();
    await userEvent.click(screen.getByRole('button', { name: /delete this win/i }));
    expect(screen.getByText('Delete this win?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(deleteNsv).toHaveBeenCalledWith('d1', 'n1');
  });

  it('shows the empty state and a log button when there are no weigh-ins', () => {
    renderBody({ series: {} });
    expect(screen.getByText('No weigh-ins yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log my weight/i })).toBeInTheDocument();
  });

  it('hides editing affordances in read-only mode', () => {
    renderBody({ readOnly: true, series: {} });
    expect(screen.getByText('No weigh-ins yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log my weight/i })).not.toBeInTheDocument();
  });
});
