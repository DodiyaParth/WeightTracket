import type { CSSProperties, ReactNode } from 'react';
import Icon from './Icon.jsx';
import { ACCESS } from '../lib/dashboards.js';
import type { Role } from '../types.js';
import type { ChangeFormat } from '../lib/format.js';

// Shared toggle switch — a real <button role="switch">, not a bare <span
// onClick>, so it's reachable and operable from the keyboard (DEV-28/29).
export function Toggle({ on, onClick, label }: { on?: boolean; onClick?: () => void; label?: string }) {
  return (
    <button
      type="button" onClick={onClick} role="switch" aria-checked={!!on} aria-label={label}
      style={{ width: 38, height: 22, borderRadius: 11, background: on ? 'var(--accent)' : 'var(--track)', position: 'relative', flex: 'none', border: 0, padding: 0, cursor: onClick ? 'pointer' : 'default' }}
    >
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: 9, background: '#fff', boxShadow: 'var(--shadow-sm)', transition: 'left .12s ease' }} />
    </button>
  );
}

// Shared segmented single-select control — a real radiogroup (DEV-28): the
// selected option is marked with aria-checked + a checkmark, never color alone.
interface SegRadioProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: [T, string][];
  ariaLabel?: string;
  disabled?: boolean;
}

export function SegRadio<T extends string>({ value, onChange, options, ariaLabel, disabled }: SegRadioProps<T>) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} disabled={disabled}
          className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {value === k && <Icon name="check" size={12} color="currentColor" />}{label}
        </button>
      ))}
    </div>
  );
}

// One role badge used everywhere. access: 'owner' | 'editor' | 'viewer'.
export function RoleBadge({ access }: { access: Role }) {
  const a = ACCESS[access] || ACCESS.viewer;
  const cls = access === 'viewer' ? 'tag view' : access === 'owner' ? 'tag owner' : 'tag editor';
  return (
    <span className={cls}>
      {access === 'viewer' && <Icon name="eye" size={13} color="currentColor" />}
      {a.label}
    </span>
  );
}

// Renders a formatChange() result with a glyph + word-carrying text, never
// relying on color alone (see lib/format.js).
export function ChangeText({ change, style }: { change: ChangeFormat; style?: CSSProperties }) {
  return (
    <span className={'change-' + change.tone} style={style} aria-label={change.aria}>
      <span aria-hidden="true">{change.glyph}</span> {change.text}
    </span>
  );
}

// A distinct "couldn't load" state (rules denial, offline, etc.) — must never be
// confused with a genuine empty/not-found state (see DEV-13).
export function RetryCard({ title = 'Couldn’t load this', message = 'Check your connection and try again.', onRetry }: { title?: ReactNode; message?: ReactNode; onRetry?: () => void }) {
  return (
    <div className="empty">
      <span className="empty-ic" style={{ background: 'var(--amber-tint)' }}><Icon name="warn" size={26} color="#b9742a" /></span>
      <h2>{title}</h2>
      <p className="t2">{message}</p>
      {onRetry && <button className="btn primary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Toast({ children }: { children?: ReactNode }) {
  return (
    <div className="toast">
      <Icon name="check" size={16} color="#fff" />
      {children}
    </div>
  );
}
