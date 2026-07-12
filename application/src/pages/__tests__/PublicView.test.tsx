import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

let asyncState;
vi.mock('../../hooks/useData.js', () => ({ usePublicView: () => asyncState }));
vi.mock('../../components/DashboardBody.jsx', () => ({ default: () => <div>BODY</div> }));

import PublicView from '../PublicView.jsx';

function renderPublic() {
  return renderWithRouter(
    <Routes>
      <Route path="/s/:token" element={<PublicView />} />
      <Route path="/login" element={<div>LOGIN</div>} />
    </Routes>,
    { route: '/s/tok123' }
  );
}

const snap = {
  dashboardId: 'd1', name: 'Parth & Priya',
  members: {
    parth: { uid: 'parth', role: 'owner', joinedAt: 1, name: 'Parth', color: '#1', initial: 'P' },
    priya: { uid: 'priya', role: 'editor', joinedAt: 2, name: 'Priya', color: '#2', initial: 'R' },
  },
  trackedUids: ['parth', 'priya'], goals: {}, teamGoal: null, habits: [],
  series: {}, habitLogs: {}, nsv: {},
};

beforeEach(() => {
  asyncState = { data: snap, loading: false, error: null, reload: vi.fn() };
});

describe('PublicView', () => {
  it('shows a loading splash', () => {
    asyncState = { data: undefined, loading: true, error: null, reload: vi.fn() };
    renderPublic();
    expect(screen.getByText('Loading shared dashboard…')).toBeInTheDocument();
  });

  it('shows a retry card on error', () => {
    asyncState = { data: undefined, loading: false, error: new Error('x'), reload: vi.fn() };
    renderPublic();
    expect(screen.getByText('Couldn’t load this dashboard')).toBeInTheDocument();
  });

  it('shows an inactive-link message and routes to sign in', async () => {
    asyncState = { data: null, loading: false, error: null, reload: vi.fn() };
    renderPublic();
    expect(screen.getByText('This link is no longer active')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('LOGIN')).toBeInTheDocument();
  });

  it('renders the shared snapshot read-only', async () => {
    renderPublic();
    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(screen.getByText('BODY')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sign in to track your own/i }));
    expect(await screen.findByText('LOGIN')).toBeInTheDocument();
  });

  it('defaults missing habits/series/habitLogs/nsv to empty collections', () => {
    asyncState = {
      data: { dashboardId: 'd1', name: 'Solo', members: {}, trackedUids: [], goals: {}, teamGoal: null },
      loading: false, error: null, reload: vi.fn(),
    };
    renderPublic();
    expect(screen.getByText('BODY')).toBeInTheDocument();
    expect(screen.getByText('View only')).toBeInTheDocument();
  });
});
