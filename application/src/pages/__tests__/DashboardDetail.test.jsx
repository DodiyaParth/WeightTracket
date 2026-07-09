import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

vi.mock('../../components/Layout.jsx', () => ({
  default: ({ title, sub, primary, children }) => (
    <div><h1>{title}</h1><div>{sub}</div><div>{primary}</div><div>{children}</div></div>
  ),
}));
vi.mock('../../components/DashboardBody.jsx', () => ({
  default: ({ onEditGoals }) => <div>BODY <button onClick={onEditGoals}>edit-goals</button></div>,
}));
vi.mock('../../components/GoalEditor.jsx', () => ({ default: () => <div>GOALS MODAL</div> }));
vi.mock('../../components/DashSettings.jsx', () => ({ default: () => <div>SETTINGS MODAL</div> }));
vi.mock('../../components/ShareModal.jsx', () => ({ default: () => <div>SHARE MODAL</div> }));

let quick;
let authValue;
vi.mock('../../components/QuickLog.jsx', () => ({ useQuickLog: () => quick }));
vi.mock('../../auth/AuthContext.jsx', () => ({ useAuth: () => authValue }));

let dashboardState;
let seriesData;
let profilesData;
vi.mock('../../hooks/useData.js', () => ({
  useDashboard: () => dashboardState,
  useDashboardSeries: () => ({ data: seriesData }),
  useHabitLogs: () => ({ data: {} }),
  useNsv: () => ({ data: {} }),
  useProfiles: () => ({ data: profilesData }),
}));

const removeMember = vi.fn();
vi.mock('../../data/repo.js', () => ({
  repo: { removeMember: (...a) => removeMember(...a) },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import DashboardDetail from '../DashboardDetail.jsx';

const ownerD = {
  id: 'd1', name: 'Parth & Priya', ownerUid: 'parth', memberUids: ['parth', 'priya'],
  members: { parth: { uid: 'parth', role: 'owner', joinedAt: 1 }, priya: { uid: 'priya', role: 'editor', joinedAt: 2 } },
  trackedUids: ['parth', 'priya'],
};

function renderDetail() {
  return renderWithRouter(
    <Routes>
      <Route path="/dashboard/:id" element={<DashboardDetail />} />
      <Route path="/" element={<div>HOME</div>} />
    </Routes>,
    { route: '/dashboard/d1' }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  quick = { open: vi.fn() };
  authValue = { user: { uid: 'parth' } };
  dashboardState = { data: ownerD, loading: false, error: null, reload: vi.fn() };
  seriesData = {};
  profilesData = { parth: { uid: 'parth', name: 'Parth' }, priya: { uid: 'priya', name: 'Priya' } };
});

describe('DashboardDetail states', () => {
  it('shows a loading skeleton', () => {
    dashboardState = { data: undefined, loading: true, error: null, reload: vi.fn() };
    renderDetail();
    expect(screen.getByRole('heading', { name: 'Loading…' })).toBeInTheDocument();
  });

  it('shows a retry card for a non-permission error', () => {
    dashboardState = { data: undefined, loading: false, error: { code: 'unavailable' }, reload: vi.fn() };
    renderDetail();
    expect(screen.getByText('Couldn’t load this dashboard')).toBeInTheDocument();
  });

  it('shows a not-found state when the dashboard is missing', () => {
    dashboardState = { data: null, loading: false, error: null, reload: vi.fn() };
    renderDetail();
    expect(screen.getByText('We couldn’t find this dashboard')).toBeInTheDocument();
  });
});

describe('DashboardDetail owner (editable)', () => {
  it('opens the settings, share and goals modals and logs weight', async () => {
    renderDetail();
    expect(screen.getByText('BODY')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Dashboard settings' }));
    expect(screen.getByText('SETTINGS MODAL')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(screen.getByText('SHARE MODAL')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'edit-goals' }));
    expect(screen.getByText('GOALS MODAL')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /log my weight/i }));
    expect(quick.open).toHaveBeenCalled();
  });

  it('does not offer a Leave button to the owner', () => {
    renderDetail();
    expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument();
  });
});

describe('DashboardDetail member (editable, non-owner)', () => {
  it('lets a member leave and navigates home', async () => {
    dashboardState = { data: { ...ownerD, ownerUid: 'someone' }, loading: false, error: null, reload: vi.fn() };
    removeMember.mockResolvedValue();
    renderDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByText('Leave this dashboard?')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Leave' }));
    expect(removeMember).toHaveBeenCalledWith('d1', 'parth');
    expect(await screen.findByText('HOME')).toBeInTheDocument();
  });
});

describe('DashboardDetail viewer (read only)', () => {
  beforeEach(() => {
    dashboardState = {
      data: { ...ownerD, ownerUid: 'someone', members: { ...ownerD.members, parth: { uid: 'parth', role: 'viewer', joinedAt: 1 } } },
      loading: false, error: null, reload: vi.fn(),
    };
  });

  it('shows a view-only tag and no share controls', () => {
    renderDetail();
    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share' })).not.toBeInTheDocument();
  });

  it('lets a viewer leave, and the confirm can be cancelled', async () => {
    renderDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByText('Leave this dashboard?')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Leave this dashboard?')).not.toBeInTheDocument();
    expect(removeMember).not.toHaveBeenCalled();
  });
});
