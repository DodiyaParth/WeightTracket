import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import Icon, { Logo, Avatar } from './Icon.jsx';
import { useQuickLog } from './QuickLog.jsx';
import { me, recents, ACCESS, notifications } from '../data.js';

export function Sidebar() {
  const nav = useNavigate();
  const loc = useLocation();
  const activeId = (loc.pathname.match(/^\/dashboard\/([^/]+)/) || [])[1];
  const rec = recents();

  return (
    <aside className="sidebar">
      <div className="brand"><Logo size={30} /><span>WeightTracker</span></div>
      <nav className="nav">
        <NavLink to="/" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          {({ isActive }) => (<><Icon name="chart" color={isActive ? 'var(--accent-dark)' : 'var(--text-2)'} /><span>Dashboards</span></>)}
        </NavLink>
        <div className="recents">
          {rec.map((d) => {
            const view = !ACCESS[d.access].editable;
            return (
              <NavLink key={d.id} to={`/dashboard/${d.id}`} className={'recent-item' + (d.id === activeId ? ' active' : '')}>
                <span className="recent-dot" style={{ background: view ? 'var(--muted)' : d.members[0].color }} />
                <span className="recent-name">{d.name}</span>
                {view && <Icon name="eye" size={15} color="var(--muted)" />}
              </NavLink>
            );
          })}
          <NavLink to="/" end className="recent-item recent-all"><span className="recent-dot" style={{ background: 'transparent' }} />All dashboards</NavLink>
        </div>
      </nav>

      <div className="nav-spacer" />
      {/* account chip → Profile (E1) */}
      <button className="nav-user" onClick={() => nav('/profile')}>
        <Avatar size={38}>{me.initial}</Avatar>
        <div className="col" style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <span className="name">{me.name}</span>
          <span className="sub">{me.email}</span>
        </div>
        <span className="icon-btn ghost-ib" style={{ width: 32, height: 32 }} title="Sign out"
          onClick={(e) => { e.stopPropagation(); nav('/login'); }}>
          <Icon name="logout" color="var(--muted)" />
        </span>
      </button>
    </aside>
  );
}

function Bell() {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => n.unread).length;
  return (
    <div className="bell-wrap">
      <button className="icon-btn" title="Notifications" onClick={() => setOpen((o) => !o)}><Icon name="bell" />{unread > 0 && <span className="dot" />}</button>
      {open && (
        <>
          <div className="dropdown-scrim" onClick={() => setOpen(false)} />
          <div className="dropdown">
            <div className="row between" style={{ padding: '4px 6px 10px' }}><span style={{ fontWeight: 600 }}>Notifications</span><button className="btn ghost sm">Mark all read</button></div>
            {notifications.map((n) => (
              <div key={n.id} className="notif">{n.unread && <span className="notif-dot" />}
                <div><div className="small" style={{ fontWeight: 500 }}>{n.text}</div><div className="muted small">{n.sub} · {n.when}</div></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// One top-bar policy (E3): search + bell + the page's primary action.
export function Topbar({ title, sub, primary }) {
  const quick = useQuickLog();
  const action = primary === undefined
    ? <button className="btn primary" onClick={() => quick.open()}><Icon name="plus" color="#fff" />Log my weight</button>
    : primary;
  return (
    <div className="topbar">
      <div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
      <div className="topbar-actions">
        <div className="search"><Icon name="search" color="var(--muted)" /><span>Search</span></div>
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
