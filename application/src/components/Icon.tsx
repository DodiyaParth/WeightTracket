import type { ReactNode } from 'react';

// Minimal line icons (20x20, currentColor stroke).
const P: Record<string, string[]> = {
  home: ['M2.5 9.5 L10 3 L17.5 9.5', 'M4.5 8.5 L4.5 17 L15.5 17 L15.5 8.5'],
  chart: ['M3 17 L17 17', 'M5.5 17 L5.5 11', 'M10 17 L10 5.5', 'M14.5 17 L14.5 9'],
  plus: ['M10 4.5 L10 15.5', 'M4.5 10 L15.5 10'],
  minus: ['M4.5 10 L15.5 10'],
  settings: ['M4 7 L16 7', 'M4 13 L16 13'],
  warn: ['M10 3 L18 16 L2 16 Z', 'M10 8 L10 11.5'],
  habits: ['M4 4 L16 4 L16 16 L4 16 Z', 'M6.5 10 L9 12.5 L13.5 7'],
  bell: ['M6 9 C6 6.8 7.8 5 10 5 C12.2 5 14 6.8 14 9 C14 13 16 14 16 14 L4 14 C4 14 6 13 6 9 Z', 'M8.5 15 C8.5 16.3 11.5 16.3 11.5 15'],
  search: ['M13 13 L17 17'],
  logout: ['M11.5 5 L5 5 L5 17 L11.5 17', 'M9 11 L17 11', 'M14 8 L17 11 L14 14'],
  close: ['M5 5 L15 15', 'M15 5 L5 15'],
  share: ['M10 13 L10 3.5', 'M6.5 7 L10 3.5 L13.5 7', 'M5 11 L5 17 L15 17 L15 11'],
  copy: ['M7 7 L16 7 L16 16 L7 16 Z', 'M4.5 13 L4 13 L4 4 L13 4 L13 4.5'],
  target: [],
  calendar: ['M4 6 L16 6 L16 16 L4 16 Z', 'M4 9 L16 9', 'M7.5 4 L7.5 7', 'M12.5 4 L12.5 7'],
  check: ['M5 10.5 L8.5 14 L15 6.5'],
  chevron: ['M8 5 L13 10 L8 15'],
  chevronL: ['M12 5 L7 10 L12 15'],
  lock: ['M5.5 9 L14.5 9 L14.5 16.5 L5.5 16.5 Z', 'M7.2 9 L7.2 7 A2.8 2.8 0 0 1 12.8 7 L12.8 9'],
  sliders: ['M4 7 L16 7', 'M4 13 L16 13'],
  upload: ['M10 13 L10 4', 'M6.5 7.5 L10 4 L13.5 7.5', 'M5 14 L5 17 L15 17 L15 14'],
  trash: ['M5 6 L15 6', 'M8 6 L8 4.5 L12 4.5 L12 6', 'M6 6 L6.5 16.5 L13.5 16.5 L14 6'],
  edit: ['M5 15 L5 12.5 L13 4.5 L15.5 7 L7.5 15 Z', 'M11 6.5 L13.5 9'],
  user: ['M4.5 16.5 C4.5 12.5 15.5 12.5 15.5 16.5'],
  users: ['M2.5 16 C2.5 13 7.5 13 7.5 16', 'M10 16 C10 12.3 16.5 12.3 16.5 16'],
  scale: ['M3.5 6 L16.5 6 L18 17 L2 17 Z', 'M10 6 L10 9'],
  eye: ['M2 10 C5 5.5 15 5.5 18 10 C15 14.5 5 14.5 2 10 Z'],
};
const CIRC: Record<string, number[][]> = {
  user: [[10, 7.5, 3]],
  users: [[5, 8, 2], [13.2, 8, 2.4]],
  search: [[9, 9, 5]],
  eye: [[10, 10, 2.4]],
  settings: [[7, 7, 2.2], [13, 13, 2.2]],
  target: [[10, 10, 6], [10, 10, 2]],
  sliders: [[7, 7, 2.2], [13, 13, 2.2]],
  scale: [[10, 11.5, 2.5]],
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  stroke?: number;
}

export default function Icon({ name, size = 20, color = 'currentColor', stroke = 1.8 }: IconProps) {
  const paths = P[name] || [];
  const circles = CIRC[name] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ display: 'block', flex: 'none' }}>
      {circles.map(([cx, cy, r], i) => (
        <circle key={'c' + i} cx={cx} cy={cy} r={r} stroke={color} strokeWidth={stroke} fill="none" />
      ))}
      {paths.map((d, i) => (
        <path key={i} d={d} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="logo" style={{ width: size, height: size, borderRadius: size * 0.3 }}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <path d="M8 30 L19 20 L27 25 L40 12" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="40" cy="12" r="3" fill="#fff" />
      </svg>
    </span>
  );
}

interface AvatarProps {
  children?: ReactNode;
  color?: string;
  size?: number;
  ring?: boolean;
}

export function Avatar({ children, color = 'var(--accent)', size = 40, ring = false }: AvatarProps) {
  return (
    <span
      className={'avatar' + (ring ? ' ring' : '')}
      style={{ width: size, height: size, fontSize: size * 0.4, background: color }}
    >
      {children}
    </span>
  );
}

// Overlapping avatar stack (shows up to `max`, then a +N chip). Open-ended people.
interface AvatarStackMember {
  color?: string;
  initial?: ReactNode;
}

export function AvatarStack({ members, size = 28, max = 3 }: { members: AvatarStackMember[]; size?: number; max?: number }) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <span className="av-stack">
      {shown.map((m, i) => (
        <Avatar key={i} size={size} color={m.color} ring>{m.initial}</Avatar>
      ))}
      {extra > 0 && (
        <span className="avatar ring" style={{ width: size, height: size, fontSize: size * 0.36, background: '#aeb6bd' }}>
          +{extra}
        </span>
      )}
    </span>
  );
}

// G logo for the Google button
export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.4 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-3.9 6.8-9.7 6.8-17.4z" />
      <path fill="#FBBC05" d="M10.4 28.3c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.8-6.1C.9 16 0 19.9 0 23.5s.9 7.5 2.6 10.9l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.4 0-11.7-3.9-13.6-9.3l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
