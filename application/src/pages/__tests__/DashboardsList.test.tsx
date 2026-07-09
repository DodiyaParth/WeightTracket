import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

vi.mock('../../components/Layout.jsx', () => ({
  default: ({ title, primary, children }) => <div><h1>{title}</h1><div>{primary}</div>{children}</div>,
}));
vi.mock('../../components/CreateDashboard.jsx', () => ({ default: () => <div>CREATE MODAL</div> }));

let authValue;
let dashboardsState;
let invitesData;
let seriesData;
let profilesData;
vi.mock('../../auth/AuthContext.jsx', () => ({ useAuth: () => authValue }));
vi.mock('../../hooks/useData.js', () => ({
  useDashboards: () => dashboardsState,
  useInvites: () => ({ data: invitesData }),
  useDashboardSeries: () => ({ data: seriesData }),
  useProfiles: () => ({ data: profilesData }),
}));

const acceptInvite = vi.fn();
const declineInvite = vi.fn();
vi.mock('../../data/repo.js', () => ({
  repo: { acceptInvite: (...a) => acceptInvite(...a), declineInvite: (...a) => declineInvite(...a) },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import DashboardsList from '../DashboardsList.jsx';

const dashboards = [
  {
    id: 'd1', name: 'Parth & Priya', ownerUid: 'parth', updatedAt: Date.now(), memberUids: ['parth', 'priya'],
    members: { parth: { uid: 'parth', role: 'owner', joinedAt: 1 }, priya: { uid: 'priya', role: 'editor', joinedAt: 2 } },
    trackedUids: ['parth', 'priya'], teamGoal: { label: 'Lose 15', target: 15 },
  },
  {
    id: 'd2', name: 'Mom journey', ownerUid: 'mom', updatedAt: Date.now(), memberUids: ['mom', 'parth'],
    members: { mom: { uid: 'mom', role: 'owner', joinedAt: 1 }, parth: { uid: 'parth', role: 'viewer', joinedAt: 2 } },
    trackedUids: ['mom'], teamGoal: null,
  },
];

function renderList() {
  return renderWithRouter(
    <Routes>
      <Route path="/" element={<DashboardsList />} />
      <Route path="/dashboard/:id" element={<div>DASH PAGE</div>} />
    </Routes>,
    { route: '/' }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  authValue = { user: { uid: 'parth', email: 'p@x.com' } };
  dashboardsState = { data: dashboards, loading: false, error: null, reload: vi.fn() };
  invitesData = [];
  seriesData = {};
  profilesData = {};
  acceptInvite.mockResolvedValue();
  declineInvite.mockResolvedValue();
});

describe('DashboardsList', () => {
  it('shows a skeleton while loading', () => {
    dashboardsState = { data: undefined, loading: true, error: null, reload: vi.fn() };
    const { container } = renderList();
    expect(container.querySelector('.skel')).toBeTruthy();
  });

  it('shows a retry card on error', () => {
    dashboardsState = { data: undefined, loading: false, error: new Error('x'), reload: vi.fn() };
    renderList();
    expect(screen.getByText('Couldn’t load your dashboards')).toBeInTheDocument();
  });

  it('shows the empty state when there is nothing', () => {
    dashboardsState = { data: [], loading: false, error: null, reload: vi.fn() };
    renderList();
    expect(screen.getByText('No dashboards yet')).toBeInTheDocument();
  });

  it('renders collaborating and view-only sections and opens a dashboard', async () => {
    renderList();
    expect(screen.getByRole('heading', { name: 'Collaborating' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'View only' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open Parth & Priya' }));
    expect(await screen.findByText('DASH PAGE')).toBeInTheDocument();
  });

  it('opens the create-dashboard modal', async () => {
    renderList();
    await userEvent.click(screen.getByRole('button', { name: 'New dashboard' }));
    expect(screen.getByText('CREATE MODAL')).toBeInTheDocument();
  });

  it('opens a dashboard and the create card via the keyboard', async () => {
    renderList();
    screen.getByRole('button', { name: 'Open Parth & Priya' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('DASH PAGE')).toBeInTheDocument();
  });

  it('opens the create card with the keyboard', async () => {
    renderList();
    screen.getByRole('button', { name: 'Create new dashboard' }).focus();
    await userEvent.keyboard(' ');
    expect(screen.getByText('CREATE MODAL')).toBeInTheDocument();
  });

  it('accepts and declines pending invites', async () => {
    invitesData = [{ id: 'inv1', fromName: 'Arjun', fromInitial: 'A', dashboardName: 'Office crew', role: 'editor', members: 4 }];
    renderList();
    expect(screen.getByText(/invited you to/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(acceptInvite).toHaveBeenCalledWith('inv1', authValue.user);

    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(screen.getByText('Decline this invite?')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Decline' }));
    expect(declineInvite).toHaveBeenCalledWith('inv1');
  });
});

describe('DashboardsList — branch coverage', () => {
  it('renders a bare dashboard with no members/tracked/series/profiles', () => {
    dashboardsState = {
      data: [{
        id: 'dx', name: 'Bare', ownerUid: 'parth', updatedAt: Date.now(),
        members: { parth: { uid: 'parth', role: 'owner', joinedAt: 1 } },
      }],
      loading: false, error: null, reload: vi.fn(),
    };
    seriesData = undefined;
    profilesData = undefined;
    renderList();
    expect(screen.getByRole('button', { name: 'Open Bare' })).toBeInTheDocument();
  });

  it('ignores non-activating keys on the dashboard and create cards', async () => {
    renderList();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Open Parth & Priya' }), { key: 'Escape' });
    expect(screen.queryByText('DASH PAGE')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Create new dashboard' }), { key: 'Escape' });
    expect(screen.queryByText('CREATE MODAL')).not.toBeInTheDocument();
  });

  it('renders a viewer invite with no member count', () => {
    invitesData = [{ id: 'inv2', fromName: 'Bob', fromInitial: 'B', dashboardName: 'Solo', role: 'viewer' }];
    renderList();
    expect(screen.getByText(/you.ll be a viewer/)).toBeInTheDocument();
    expect(screen.queryByText(/people ·/)).not.toBeInTheDocument();
  });

  it('surfaces a row error when accepting an invite fails', async () => {
    acceptInvite.mockRejectedValueOnce(new Error('accept nope'));
    invitesData = [{ id: 'inv3', fromName: 'Cara', fromInitial: 'C', dashboardName: 'Crew', role: 'editor', members: 3 }];
    renderList();
    await userEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(await screen.findByText(/Couldn.t accept that invite/)).toBeInTheDocument();
  });
});
