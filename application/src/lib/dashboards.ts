// Dashboard access model + navigation logic (REQUIREMENTS §11).
import { DAY_MS } from './date.js';
import { colorForIndex, initials } from './colors.js';
import type { Dashboard, EnrichedMember, Member, Profile, Role } from '../types.js';

export const ACCESS: Record<Role, { label: string; editable: boolean }> = {
  owner: { label: 'Owner', editable: true },
  editor: { label: 'Editor', editable: true },
  viewer: { label: 'View only', editable: false },
};

// A user's role on a dashboard, derived from its membership maps. `uid` is
// optional because callers pass `user?.uid`; a missing uid is treated as a
// non-member (viewer), exactly as the membership lookup below already resolved.
export function accessFor(dashboard: Dashboard | null | undefined, uid: string | undefined): Role {
  if (!dashboard || !uid) return 'viewer';
  if (dashboard.ownerUid === uid) return 'owner';
  const role = dashboard.members?.[uid]?.role;
  if (role === 'editor' || role === 'owner') return role === 'owner' ? 'owner' : 'editor';
  return 'viewer';
}

export const isEditable = (dashboard: Dashboard | null | undefined, uid: string | undefined): boolean =>
  ACCESS[accessFor(dashboard, uid)].editable;

const byUpdatedDesc = (a: Dashboard, b: Dashboard): number => (b.updatedAt || 0) - (a.updatedAt || 0);

export const collaborating = (dashboards: Dashboard[] | null | undefined, uid: string | undefined): Dashboard[] =>
  (dashboards || []).filter((d) => isEditable(d, uid)).sort(byUpdatedDesc);

export const viewOnly = (dashboards: Dashboard[] | null | undefined, uid: string | undefined): Dashboard[] =>
  (dashboards || []).filter((d) => !isEditable(d, uid)).sort(byUpdatedDesc);

// Sidebar recents: collaboration first, then view-only, capped at `n` (§11.1).
export const recents = (dashboards: Dashboard[] | null | undefined, uid: string | undefined, n = 5): Dashboard[] =>
  [...collaborating(dashboards, uid), ...viewOnly(dashboards, uid)].slice(0, n);

// Post-login landing (§11.2): most-recent collaboration dashboard updated in the
// last 7 days, else most-recent view-only in 7 days, else the list ('/').
export function landingRoute(dashboards: Dashboard[] | null | undefined, uid: string | undefined, now: number = Date.now()): string {
  const within7 = (list: Dashboard[]) => list.filter((d) => now - (d.updatedAt || 0) <= 7 * DAY_MS);
  const c = within7(collaborating(dashboards, uid))[0];
  if (c) return `/dashboard/${c.id}`;
  const v = within7(viewOnly(dashboards, uid))[0];
  if (v) return `/dashboard/${v.id}`;
  return '/';
}

// Owner first, then by joinedAt — the one membership ordering everything else
// (color assignment, display order) derives from.
function sortedMembers(dashboard: Dashboard | null | undefined): Member[] {
  if (!dashboard?.members) return [];
  return Object.values(dashboard.members).sort((a, b) => {
    if (a.uid === dashboard.ownerUid) return -1;
    if (b.uid === dashboard.ownerUid) return 1;
    return (a.joinedAt || 0) - (b.joinedAt || 0);
  });
}

// Ordered, display-ready member list. The dashboard's own `members` map holds
// only non-derivable membership facts (uid/role/joinedAt) — name/email/photoURL/
// heightM/color/initial are never stored, always derived here: from a live
// `profiles` map (signed-in views) or, absent one, from whatever's already on
// the member record itself (a public-view snapshot, which — unlike the live
// app — has no live profile to join against and so carries its own enriched
// copy, refreshed on every relevant write; see firestore.js rebuildPublic).
export function memberList(dashboard: Dashboard | null | undefined, profiles: Record<string, Profile> = {}): EnrichedMember[] {
  return sortedMembers(dashboard).map((m, i): EnrichedMember => {
    const p: Partial<Profile> = profiles[m.uid] || m;
    return {
      uid: m.uid, role: m.role, joinedAt: m.joinedAt,
      name: p.name || 'Member', email: p.email || '', photoURL: p.photoURL || null,
      heightM: p.heightM ?? null,
      color: colorForIndex(i),
      initial: initials(p.name, p.email),
    };
  });
}

// Color for one member without needing a profile fetch — same position-based
// rule memberList uses, for call sites (e.g. a sidebar dot) that only need a
// color, not a name.
export function colorForMember(dashboard: Dashboard | null | undefined, uid: string): string {
  const idx = sortedMembers(dashboard).findIndex((m) => m.uid === uid);
  return colorForIndex(idx < 0 ? 0 : idx);
}
