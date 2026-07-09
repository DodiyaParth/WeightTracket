import React from 'react';
import Icon from './Icon.jsx';
import { ACCESS } from '../data.js';

// One shared toggle switch (F4 — was duplicated 3×, drifting).
export function Toggle({ on, onClick }) {
  return (
    <span onClick={onClick} role="switch" aria-checked={!!on}
      style={{ width: 38, height: 22, borderRadius: 11, background: on ? 'var(--accent)' : 'var(--track)', position: 'relative', flex: 'none', cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: 9, background: '#fff', boxShadow: 'var(--shadow-sm)', transition: 'left .12s ease' }} />
    </span>
  );
}

// One role badge used everywhere (D8). Reserve .pill for transient statuses.
export function RoleBadge({ access }) {
  const a = ACCESS[access];
  const cls = access === 'viewonly' ? 'tag view' : access === 'owner' ? 'tag owner' : 'tag editor';
  return <span className={cls}>{access === 'viewonly' && <Icon name="eye" size={13} color="currentColor" />}{a.label}</span>;
}

// Lightweight success toast.
export function Toast({ children }) {
  return (
    <div className="toast"><Icon name="check" size={16} color="#fff" />{children}</div>
  );
}
