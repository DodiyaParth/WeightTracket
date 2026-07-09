import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Icon, { Logo, AvatarStack } from '../components/Icon.jsx';
import DashboardBody from '../components/DashboardBody.jsx';
import Splash from '../components/Splash.jsx';
import { RetryCard } from '../components/ui.jsx';
import { useAsync } from '../hooks/useData.js';
import { repo } from '../data/repo.js';
import { memberList } from '../lib/dashboards.js';

// The no-login read-only view (REQUIREMENTS §11.5). No sidebar, no account menu,
// no edit controls — renders a world-readable snapshot keyed by the link token.
export default function PublicView() {
  const { token } = useParams();
  const nav = useNavigate();
  const { data: snap, loading, error, reload } = useAsync(() => repo.getPublicView(token), [token]);

  if (loading) return <Splash label="Loading shared dashboard…" />;

  if (error) {
    return (
      <div className="public">
        <header className="public-top">
          <div className="row" style={{ gap: 12 }}><Logo size={28} /><span style={{ fontWeight: 600 }}>WeightTracker</span></div>
        </header>
        <div className="public-body" style={{ alignItems: 'center', paddingTop: 80 }}>
          <RetryCard title="Couldn’t load this dashboard" message="Check your connection and try again." onRetry={reload} />
        </div>
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="public">
        <header className="public-top">
          <div className="row" style={{ gap: 12 }}><Logo size={28} /><span style={{ fontWeight: 600 }}>WeightTracker</span></div>
        </header>
        <div className="public-body" style={{ alignItems: 'center', paddingTop: 80 }}>
          <div className="empty" style={{ maxWidth: 460 }}>
            <span className="empty-ic" style={{ background: 'var(--track)' }}><Icon name="eye" size={26} color="var(--muted)" /></span>
            <h2>This link is no longer active</h2>
            <p className="t2">The owner has turned off link sharing for this dashboard. Ask them for a fresh link, or sign in if you have access.</p>
            <button className="btn primary" onClick={() => nav('/login')}>Sign in</button>
          </div>
        </div>
      </div>
    );
  }

  const dashboard = {
    id: snap.dashboardId, name: snap.name, members: snap.members, trackedUids: snap.trackedUids,
    goals: snap.goals, teamGoal: snap.teamGoal, habits: snap.habits || [], public: {}, settings: {},
  };
  const members = memberList(dashboard);

  return (
    <div className="public">
      <header className="public-top">
        <div className="row" style={{ gap: 12 }}>
          <Logo size={28} /><span style={{ fontWeight: 600 }}>{snap.name}</span>
          <span className="tag view"><Icon name="eye" size={13} color="currentColor" />View only</span>
        </div>
        <div className="row" style={{ gap: 14 }}>
          <AvatarStack members={members} size={30} />
          <button className="btn primary" onClick={() => nav('/login')}>Sign in to track your own</button>
        </div>
      </header>
      <div className="public-body">
        <div className="public-note"><Icon name="eye" size={16} color="var(--accent-dark)" />You’re viewing a shared dashboard. This is read-only — sign in to start your own.</div>
        <DashboardBody dashboard={dashboard} series={snap.series || {}} habitLogs={snap.habitLogs || {}} nsv={snap.nsv || {}} meUid={null} readOnly />
      </div>
      <footer className="public-foot"><Logo size={22} /><span className="muted small">Made with WeightTracker · Health guidance here is general information, not medical advice.</span></footer>
    </div>
  );
}
