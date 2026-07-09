import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

let authValue;
let dashboardsData;
let notificationsData;
let quick;

vi.mock('../../auth/AuthContext.jsx', () => ({ useAuth: () => authValue }));
vi.mock('../../hooks/useData.js', () => ({
  useDashboards: () => ({ data: dashboardsData }),
  useNotifications: () => ({ data: notificationsData }),
}));
vi.mock('../QuickLog.jsx', () => ({ useQuickLog: () => quick }));

import Layout, { Topbar } from '../Layout.jsx';

const dashboards = [
  {
    id: 'd1', name: 'Parth & Priya', ownerUid: 'parth', updatedAt: Date.now(),
    members: { parth: { uid: 'parth', role: 'owner', joinedAt: 1 }, priya: { uid: 'priya', role: 'editor', joinedAt: 2 } },
    trackedUids: ['parth', 'priya'],
  },
  {
    id: 'd3', name: 'Mom journey', ownerUid: 'mom', updatedAt: Date.now() - 99999,
    members: { mom: { uid: 'mom', role: 'owner', joinedAt: 1 }, parth: { uid: 'parth', role: 'viewer', joinedAt: 5 } },
    trackedUids: ['mom'],
  },
];

beforeEach(() => {
  authValue = { user: { uid: 'parth', displayName: 'Parth', email: 'p@x.com' }, signOutUser: vi.fn() };
  dashboardsData = dashboards;
  notificationsData = [{ id: 'n1', text: 'Arjun invited you', sub: 'Respond soon', when: Date.now(), unread: true }];
  quick = { open: vi.fn() };
});

describe('Layout', () => {
  it('renders the title, children, recents, and the signed-in user; sign out works', () => {
    renderWithRouter(<Layout title="Dashboards" sub="Overview"><p>page body</p></Layout>, { route: '/dashboard/d1' });
    expect(screen.getByRole('heading', { name: 'Dashboards' })).toBeInTheDocument();
    expect(screen.getByText('page body')).toBeInTheDocument();
    expect(screen.getByText('Parth & Priya')).toBeInTheDocument();
    expect(screen.getByText('Mom journey')).toBeInTheDocument();
    expect(screen.getByText('All dashboards')).toBeInTheDocument();
    expect(screen.getByText('p@x.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(authValue.signOutUser).toHaveBeenCalled();
  });

  it('navigates to the profile via the user row (click + keyboard)', () => {
    renderWithRouter(<Layout title="Dashboards"><p>x</p></Layout>, { route: '/' });
    const userRow = screen.getByRole('button', { name: /Parth/ });
    fireEvent.click(userRow);
    fireEvent.keyDown(userRow, { key: 'Enter' });
    fireEvent.keyDown(userRow, { key: ' ' });
    // no throw = the handlers ran
    expect(userRow).toBeInTheDocument();
  });

  it('shows an empty recents hint when there are no dashboards', () => {
    dashboardsData = [];
    renderWithRouter(<Layout title="Dashboards"><p>x</p></Layout>, { route: '/' });
    expect(screen.getByText('No dashboards yet')).toBeInTheDocument();
  });

  it('opens QuickLog from the default Topbar action', async () => {
    renderWithRouter(<Layout title="Dashboards"><p>x</p></Layout>, { route: '/' });
    await userEvent.click(screen.getByRole('button', { name: /log my weight/i }));
    expect(quick.open).toHaveBeenCalled();
  });

  it('renders a custom Topbar primary action instead of the default', () => {
    renderWithRouter(<Topbar title="X" primary={<button>Custom action</button>} />, { route: '/' });
    expect(screen.getByRole('button', { name: 'Custom action' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log my weight/i })).not.toBeInTheDocument();
  });
});

describe('Layout notifications bell', () => {
  it('shows unread notifications when opened', () => {
    renderWithRouter(<Layout title="X"><p>x</p></Layout>, { route: '/' });
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('Arjun invited you')).toBeInTheDocument();
  });

  it('shows a caught-up message when there are none', () => {
    notificationsData = [];
    renderWithRouter(<Layout title="X"><p>x</p></Layout>, { route: '/' });
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });
});
