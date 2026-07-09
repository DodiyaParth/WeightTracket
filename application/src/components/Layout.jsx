import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import Icon, { Logo } from './Icon.jsx';
import UserAvatar from './UserAvatar.jsx';
import { useQuickLog } from './QuickLog.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useDashboards, useNotifications } from '../hooks/useData.js';
import { recents, isEditable, colorForMember } from '../lib/dashboards.js';
import { firstNameOf } from '../lib/user.js';
import { fmtDate } from '../lib/date.js';

function Sidebar() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, signOutUser } = useAuth();
  const { data: dashboards } = useDashboards(user?.uid);
  const activeId = (loc.pathname.match(/^\/dashboard\/([^/]+)/) || [])[1];
  const rec = recents(dashboards || [], user?.uid);

  return (
    <aside className="sidebar">
      <div className="brand"><Logo size={30} /><span>WeightTracker</span></div>
      <nav className="nav">
        <NavLink to="/" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          {({ isActive }) => (<><Icon name="chart" color={isActive ? 'var(--accent-dark)' : 'var(--text-2)'} /><span>Dashboards</span></>)}
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          {({ isActive }) => (<><Icon name="calendar" color={isActive ? 'var(--accent-dark)' : 'var(--text-2)'} /><span>History</span></>)}
        </NavLink>
        <div className="recents">
          {rec.length === 0 && <div className="recent-item recent-all" style={{ borderLeftColor: 'transparent', cursor: 'default' }}>No dashboards yet</div>}
          {rec.map((d) => {
            const view = !isEditable(d, user?.uid);
            const dot = view ? 'var(--muted)' : colorForMember(d, d.trackedUids?.[0]);
            return (
              <NavLink key={d.id} to={`/dashboard/${d.id}`} className={'recent-item' + (d.id === activeId ? ' active' : '')}>
                <span className="recent-dot" style={{ background: dot }} />
                <span className="recent-name">{d.name}</span>
                {view && <Icon name="eye" size={15} color="var(--muted)" />}
              </NavLink>
            );
          })}
          {rec.length > 0 && (
            <NavLink to="/" end className="recent-item recent-all"><span className="recent-dot" style={{ background: 'transparent' }} />All dashboards</NavLink>
          )}
        </div>
      </nav>

      <div className="nav-spacer" />
      <div className="nav-user" style={{ cursor: 'pointer' }} onClick={() => nav('/profile')} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nav('/profile'); } }}>
        <UserAvatar user={user} size={38} />
        <div className="col" style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <span className="name">{user?.displayName || firstNameOf(null, user?.email)}</span>
          <span className="sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</span>
        </div>
        <button className="icon-btn ghost-ib" style={{ width: 32, height: 32 }} title="Sign out" aria-label="Sign out"
          onClick={(e) => { e.stopPropagation(); signOutUser(); }}>
          <Icon name="logout" color="var(--muted)" />
        </button>
      </div>
    </aside>
  );
}

function Bell() {
  const { user } = useAuth();
  const { data: notifications } = useNotifications(user?.uid);
  const [open, setOpen] = useState(false);
  const list = notifications || [];
  const unread = list.filter((n) => n.unread).length;
  return (
    <div className="bell-wrap">
      <button className="icon-btn" title="Notifications" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="bell" />{unread > 0 && <span className="dot" />}
      </button>
      {open && (
        <>
          <div className="dropdown-scrim" onClick={() => setOpen(false)} />
          <div className="dropdown">
            <div className="row between" style={{ padding: '4px 6px 10px' }}><span style={{ fontWeight: 600 }}>Notifications</span></div>
            {list.length === 0 && <div className="muted small" style={{ padding: '6px' }}>You’re all caught up.</div>}
            {list.map((n) => (
              <div key={n.id} className="notif">
                {n.unread && <span className="notif-dot" />}
                <div><div className="small" style={{ fontWeight: 500 }}>{n.text}</div><div className="muted small">{n.sub} · {fmtDate(n.when)}</div></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Topbar({ title, sub, primary }) {
  const quick = useQuickLog();
  const action = primary === undefined
    ? <button className="btn primary" onClick={() => quick.open()}><Icon name="plus" color="#fff" />Log my weight</button>
    : primary;
  return (
    <div className="topbar">
      <div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
      <div className="topbar-actions">
        <Bell />
        {action}
      </div>
    </div>
  );
}

export default function Layout({ title, sub, primary, children }) {
  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar title={title} sub={sub} primary={primary} />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
