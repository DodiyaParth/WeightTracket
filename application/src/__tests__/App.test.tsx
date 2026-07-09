import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter } from '../test/test-utils.jsx';

let authValue;
let dashboardsState;
const landingRoute = vi.fn();

vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => authValue,
  AuthProvider: ({ children }) => children,
}));
vi.mock('../hooks/useData.js', () => ({ useDashboards: () => dashboardsState }));
vi.mock('../lib/dashboards.js', () => ({ landingRoute: (...a) => landingRoute(...a) }));
vi.mock('../components/QuickLog.jsx', () => ({ QuickLogProvider: ({ children }) => children }));
vi.mock('../components/Splash.jsx', () => ({ default: () => <div>SPLASH</div> }));
vi.mock('../pages/Login.jsx', () => ({ default: () => <div>LOGIN</div> }));
vi.mock('../pages/DashboardsList.jsx', () => ({ default: () => <div>DASH_LIST</div> }));
vi.mock('../pages/DashboardDetail.jsx', () => ({ default: () => <div>DASH_DETAIL</div> }));
vi.mock('../pages/AddWeight.jsx', () => ({ default: () => <div>ADD_WEIGHT</div> }));
vi.mock('../pages/History.jsx', () => ({ default: () => <div>HISTORY</div> }));
vi.mock('../pages/Profile.jsx', () => ({ default: () => <div>PROFILE</div> }));
vi.mock('../pages/PublicView.jsx', () => ({ default: () => <div>PUBLIC</div> }));
vi.mock('../pages/NotFound.jsx', () => ({ default: () => <div>NOTFOUND</div> }));

import App from '../App.jsx';

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  authValue = { user: { uid: 'parth' }, loading: false };
  dashboardsState = { data: [], loading: false };
  landingRoute.mockReturnValue('/');
});

describe('App routing', () => {
  it('renders the login page at /login', () => {
    renderWithRouter(<App />, { route: '/login' });
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('renders the public view at /s/:token', () => {
    renderWithRouter(<App />, { route: '/s/demo-token' });
    expect(screen.getByText('PUBLIC')).toBeInTheDocument();
  });

  it('renders NotFound for an unknown route', () => {
    renderWithRouter(<App />, { route: '/nowhere' });
    expect(screen.getByText('NOTFOUND')).toBeInTheDocument();
  });

  it('renders a protected page (/add) for a signed-in user', () => {
    renderWithRouter(<App />, { route: '/add' });
    expect(screen.getByText('ADD_WEIGHT')).toBeInTheDocument();
  });

  it('lands on the dashboards list when landingRoute stays at "/"', async () => {
    renderWithRouter(<App />, { route: '/' });
    expect(await screen.findByText('DASH_LIST')).toBeInTheDocument();
  });

  it('redirects on first visit when landingRoute points at a specific dashboard', async () => {
    landingRoute.mockReturnValue('/dashboard/d1');
    renderWithRouter(<App />, { route: '/' });
    expect(await screen.findByText('DASH_DETAIL')).toBeInTheDocument();
  });

  it('shows the splash while dashboards are still loading', () => {
    dashboardsState = { data: undefined, loading: true };
    renderWithRouter(<App />, { route: '/' });
    expect(screen.getByText('SPLASH')).toBeInTheDocument();
  });

  it('skips the landing redirect on a later visit (already landed this session)', async () => {
    sessionStorage.setItem('wt_landed_parth', '1');
    landingRoute.mockReturnValue('/dashboard/d1'); // would redirect, but we already landed
    renderWithRouter(<App />, { route: '/' });
    expect(await screen.findByText('DASH_LIST')).toBeInTheDocument();
    expect(landingRoute).not.toHaveBeenCalled();
  });

  it('defaults an undefined dashboards list to [] when choosing the landing route', async () => {
    dashboardsState = { data: undefined, loading: false };
    landingRoute.mockReturnValue('/dashboard/d1');
    renderWithRouter(<App />, { route: '/' });
    expect(await screen.findByText('DASH_DETAIL')).toBeInTheDocument();
    expect(landingRoute).toHaveBeenCalledWith([], 'parth');
  });

  it('tolerates sessionStorage throwing while resolving the landing route', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    landingRoute.mockReturnValue('/');
    renderWithRouter(<App />, { route: '/' });
    expect(await screen.findByText('DASH_LIST')).toBeInTheDocument();
    spy.mockRestore();
  });
});
