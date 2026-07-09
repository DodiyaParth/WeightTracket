// Person color assignment. Five distinct accents; assigned stably by join order.
// Semantic: teal = primary/person-1, indigo = person-2, amber = caution, rose = gain.
export const PERSON_COLORS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)', 'var(--p5)'];

export const colorForIndex = (i: number): string => PERSON_COLORS[i % PERSON_COLORS.length];

// 2-letter initials from a display name (or email fallback).
export function initials(name?: string | null, email?: string | null): string {
  const n = (name || '').trim();
  if (n) {
    const parts = n.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}
