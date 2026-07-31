// Dashboard access model + navigation logic (REQUIREMENTS §11).
import { DAY_MS } from './date.js';
import { colorForIndex, initials } from './colors.js';
import { currentWeight } from './stats.js';
import { journeyDirection, type Direction } from './health.js';
import type { Dashboard, EnrichedMember, Goal, Member, Profile, Role, SeriesPoint } from '../types.js';

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

// ---- Goal start resolution + derived team goal (PRD §7, §8) -------------

export interface ResolvedStart { startISO: string | null; startKg: number | null; }

// A goal's starting weight is never stored (see types.ts Goal): it's the
// weigh-in on `startISO`. Legacy goals (written before the guided wizard) have
// no `startISO`, so they fall back to the earliest weigh-in — matching the
// pre-wizard behavior exactly. Exact-date match only (PRD §7: no nearest-date
// snapping); if `startISO` is set but has no weigh-in, startKg is null so the
// UI can prompt for it rather than silently anchoring to the wrong day.
export function resolveStart(goal: Goal | undefined, entries: SeriesPoint[] | undefined): ResolvedStart {
  const list = entries || [];
  if (goal?.startISO) {
    const at = list.find((e) => e.date === goal.startISO);
    return { startISO: goal.startISO, startKg: at ? at.kg : null };
  }
  return { startISO: list[0]?.date ?? null, startKg: list[0]?.kg ?? null };
}

export interface DerivedTeamGoal {
  targetKg: number;         // Σ |target_i − start_i| across all contributing members
  progressKg: number;       // Σ clamp(movement toward target_i, 0, |Δ_i|)
  pct: number;              // progressKg / targetKg, clamped 0..1
  targetISO: string | null; // the latest member target date
  direction: Direction | 'mixed';
  label: string;
  memberCount: number;      // how many members have a goal (the card shows at ≥2)
}

// The shared team goal, derived on read (never stored — derive-don't-store,
// [[weighttracker-engineering-principles]]). Sums every member's absolute
// planned change regardless of direction (PRD §8.2 worked example: an 8 kg loss
// + a 3 kg gain = 11 kg of combined change). Returns null for a solo dashboard
// (a personal journey until someone joins) — the card appears only at ≥2
// members with goals.
export function deriveTeamGoal(dashboard: Dashboard | null | undefined, series: Record<string, SeriesPoint[]> = {}): DerivedTeamGoal | null {
  if (!dashboard) return null;
  const contributions = (dashboard.trackedUids || []).flatMap((uid) => {
    const goal = dashboard.goals?.[uid];
    if (!goal || goal.targetKg == null) return [];
    const { startKg } = resolveStart(goal, series[uid]);
    if (startKg == null) return [];
    const target = goal.targetKg;
    const magnitude = Math.abs(target - startKg);
    const current = currentWeight(series[uid]) ?? startKg;
    // Signed movement projected onto the start→target direction, so a member
    // moving the wrong way contributes 0 (not negative) and one past target
    // caps at their own magnitude.
    const moved = Math.max(0, Math.min(magnitude, (current - startKg) * Math.sign(target - startKg)));
    return [{ magnitude, moved, targetISO: goal.targetISO ?? null, direction: journeyDirection(startKg, target) }];
  });
  if (contributions.length < 2) return null;

  const targetKg = +contributions.reduce((sum, c) => sum + c.magnitude, 0).toFixed(2);
  const progressKg = +contributions.reduce((sum, c) => sum + c.moved, 0).toFixed(2);
  const pct = targetKg > 0 ? Math.max(0, Math.min(1, progressKg / targetKg)) : 0;
  const dates = contributions.map((c) => c.targetISO).filter((d): d is string => !!d);
  const targetISO = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  // Label by the mix of *directional* goals; maintainers (≈0 change) don't
  // force a "mixed" label on their own.
  const dirs = new Set(contributions.map((c) => c.direction).filter((d) => d !== 'maintain'));
  const direction: Direction | 'mixed' = dirs.size === 1 ? ([...dirs][0] as Direction) : 'mixed';
  const rounded = Math.round(targetKg);
  const label = direction === 'loss' ? `Lose ${rounded} kg together`
    : direction === 'gain' ? `Gain ${rounded} kg together`
      : `${rounded} kg of combined change together`;

  return { targetKg, progressKg, pct, targetISO, direction, label, memberCount: contributions.length };
}
