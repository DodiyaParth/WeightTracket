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
  goals: { parth: { targetKg: 80, targetISO: '2026-12-31' } },
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

// ---- Branch-focused scenarios --------------------------------------------
const makeFlat = (kg, n) => {
  const base = Date.UTC(2026, 0, 1);
  return Array.from({ length: n }, (_, i) => ({ id: `f${i}`, date: new Date(base + i * 86400000).toISOString().slice(0, 10), kg, note: '' }));
};
const solo = (goals, teamGoal = null) => ({
  id: 'dS', name: 'Solo', ownerUid: 'me',
  members: { me: { uid: 'me', role: 'owner', joinedAt: 1 } },
  trackedUids: ['me'], goals, teamGoal, habits: [],
});
const soloProfiles = { me: { uid: 'me', name: 'Me', heightM: 1.8 } };

function renderCustom(props) {
  renderWithRouter(<DashboardBody meUid="me" onEditGoals={vi.fn()} profiles={soloProfiles} habitLogs={{}} nsv={{}} {...props} />);
}

describe('DashboardBody — pacing & projection branches', () => {
  it('flags a faster-than-safe weekly pace', () => {
    renderCustom({ dashboard: solo({ me: { targetKg: 70, targetISO: '2028-01-01' } }), series: { me: makeSeries(90, 30).map((e, i) => ({ ...e, kg: +(90 - i * 0.6).toFixed(1) })) } });
    expect(screen.getByText('faster than safe pace')).toBeInTheDocument();
  });

  it('shows "No estimate" when the trend is flat / moving away', () => {
    renderCustom({ dashboard: solo({ me: { targetKg: 80, targetISO: '2026-02-15' } }), series: { me: makeFlat(85, 30) } });
    expect(screen.getByText('No estimate')).toBeInTheDocument();
    expect(screen.getAllByText(/trend moving away/).length).toBeGreaterThan(0);
  });

  it('locks the projection with fewer than 14 days of data', () => {
    renderCustom({ dashboard: solo({ me: { targetKg: 80 } }), series: { me: makeSeries(85, 8) } });
    expect(screen.getAllByText('need more data').length).toBeGreaterThan(0);
  });
});

describe('DashboardBody — goal rows & team goal branches', () => {
  it('renders an undated goal, a null current weight, and no team goal', () => {
    const dashboard = {
      id: 'dG', name: 'Pair', ownerUid: 'me',
      members: { me: { uid: 'me', role: 'owner', joinedAt: 1 }, you: { uid: 'you', role: 'editor', joinedAt: 2 } },
      trackedUids: ['me', 'you'],
      goals: { me: { targetKg: 82 }, you: { targetKg: 70 } }, // no startKg, no targetISO
      teamGoal: null, habits: [],
    };
    renderCustom({ dashboard, series: { me: makeSeries(88, 20) }, profiles: { me: { name: 'Me', heightM: 1.8 }, you: { name: 'You', heightM: 1.7 } } });
    expect(screen.getAllByText(/no date · safe-pace ETA/).length).toBeGreaterThan(0);
    // "you" has a goal but no series → current renders as the em dash
    expect(screen.getAllByText(/→/).length).toBeGreaterThan(0);
  });

  it('renders a team goal with a zero target (0% progress)', () => {
    renderCustom({ dashboard: solo({ me: { targetKg: 80 } }, { label: 'Team', target: 0 }), series: { me: makeSeries(85, 20) } });
    expect(screen.getByText(/Team goal · Team/)).toBeInTheDocument();
  });
});

describe('DashboardBody — focus and wins branches', () => {
  it('handles a focused member who has no data of their own', () => {
    const dashboard = {
      id: 'dN', name: 'Pair', ownerUid: 'me',
      members: { me: { uid: 'me', role: 'owner', joinedAt: 1 }, you: { uid: 'you', role: 'editor', joinedAt: 2 } },
      trackedUids: ['me', 'you'], goals: {}, teamGoal: null, habits: [],
    };
    // "me" (the default focus) has nothing; "you" carries the data so the board still renders.
    renderCustom({ dashboard, series: { you: makeSeries(80, 20) }, profiles: { me: { name: 'Me', heightM: 1.8 }, you: { name: 'You', heightM: 1.7 } } });
    expect(screen.getByText(/Showing Me’s stats/)).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0); // current weight dash
  });

  it('ignores an empty win, saves on Enter, and surfaces a save error', async () => {
    renderCustom({ dashboard: solo({ me: { targetKg: 80 } }), series: { me: makeSeries(85, 20) } });
    await userEvent.click(screen.getByRole('button', { name: /^Add$/i }));
    // empty text → Save is a no-op
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(addNsv).not.toHaveBeenCalled();

    addNsv.mockRejectedValueOnce(new Error('nope'));
    const input = screen.getByPlaceholderText(/rings feel looser/i);
    await userEvent.type(input, 'Win via Enter{Enter}');
    expect(addNsv).toHaveBeenCalled();
  });
});
