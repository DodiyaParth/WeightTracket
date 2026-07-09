import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

vi.mock('../../components/Layout.jsx', () => ({
  default: ({ title, primary, children }) => <div><h1>{title}</h1><div>{primary}</div>{children}</div>,
}));
vi.mock('../../components/CreateDashboard.jsx', () => ({ default: () => <div>CREATE MODAL</div> }));

let authValue;
let dashboardsState;
let invitesData;
vi.mock('../../auth/AuthContext.jsx', () => ({ useAuth: () => authValue }));
vi.mock('../../hooks/useData.js', () => ({
  useDashboards: () => dashboardsState,
  useInvites: () => ({ data: invitesData }),
  useDashboardSeries: () => ({ data: {} }),
  useProfiles: () => ({ data: {} }),
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
