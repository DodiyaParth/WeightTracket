import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { Logo, AvatarStack } from '../components/Icon.jsx';
import DashboardBody from '../components/DashboardBody.jsx';
import { getDashboard } from '../data.js';

// What a read-only public link opens: no login, no sidebar, no account menu.
export default function PublicView() {
  const nav = useNavigate();
  const d = getDashboard('d1');
  const [revoked, setRevoked] = useState(false);

  return (
    <div className="public">
      {/* fenced prototype-only control (D6) — not part of the real public header */}
      <div className="proto-controls" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0 }}>
        <span className="proto-label">Prototype preview</span>
        <div className="range-tabs">
          <button className={!revoked ? 'on' : ''} onClick={() => setRevoked(false)}>Active link</button>
          <button className={revoked ? 'on' : ''} onClick={() => setRevoked(true)}>Revoked link</button>
        </div>
      </div>

      <header className="public-top">
        <div className="row" style={{ gap: 12 }}>
          <Logo size={28} /><span style={{ fontWeight: 600 }}>{d.name}</span>
          {!revoked && <span className="tag view"><Icon name="eye" size={13} color="currentColor" />View only</span>}
        </div>
        <div className="row" style={{ gap: 14 }}>
          <AvatarStack members={d.members} size={30} />
          {!revoked && <button className="btn primary" onClick={() => nav('/login')}>Sign in to track your own</button>}
        </div>
      </header>

      {revoked ? (
        <div className="public-body" style={{ alignItems: 'center', paddingTop: 80 }}>
          <div className="empty" style={{ maxWidth: 460 }}>
            <span className="empty-ic" style={{ background: 'var(--track)' }}><Icon name="eye" size={26} color="var(--muted)" /></span>
            <h2>This link is no longer active</h2>
            <p className="t2">The owner has turned off link sharing for this dashboard. Ask them for a fresh link, or sign in if you have access.</p>
            <button className="btn primary" onClick={() => nav('/login')}>Sign in</button>
          </div>
        </div>
      ) : (
        <div className="public-body">
          <div className="public-note"><Icon name="eye" size={16} color="var(--accent-dark)" />You’re viewing a shared dashboard. This is read-only — sign in to start your own.</div>
          <DashboardBody readOnly members={d.members} />
        </div>
      )}

      <footer className="public-foot"><Logo size={22} /><span className="muted small">Made with WeightTracker · Health guidance here is general information, not medical advice.</span></footer>
    </div>
  );
}
