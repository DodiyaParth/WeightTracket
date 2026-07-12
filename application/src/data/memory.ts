// In-memory backend (demo mode + reference implementation). Same async API as
// the Firestore backend. Weight series for a dashboard are derived from each
// member's canonical weights, so logging a weigh-in reflects everywhere.
import { buildSeed } from './seed.js';
import { todayISO } from '../lib/date.js';
import { memberList } from '../lib/dashboards.js';
import { applyAutoGrace } from '../lib/habits.js';
import type {
  AuthUser, Dashboard, HabitLog, HabitMark, Invite, Nsv, Notification, Profile,
  PublicLink, PublicMember, PublicView, Role, SeriesPoint, WeightEntry,
} from '../types.js';
import type { DataRepo } from './DataRepo.js';

let store = buildSeed();
export function _resetStore() { store = buildSeed(); } // for tests

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const rid = (p = 'id'): string => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const ok = <T = void>(v?: T): Promise<T> => Promise.resolve(v as T);

const trackedSeries = (uid: string): SeriesPoint[] => (store.weights[uid] || []).map((e) => ({ date: e.date, kg: e.kg }));
const bumpForUser = (uid: string): void => {
  store.dashboards.forEach((d) => { if (d.trackedUids.includes(uid)) d.updatedAt = Date.now(); });
};

// ---- profile ------------------------------------------------------------
export const getProfile = (uid: string): Promise<Profile | null> =>
  ok(store.profiles[uid] ? clone(store.profiles[uid]) : null);

export const getProfiles = (uids?: string[] | null): Promise<Record<string, Profile>> => {
  const out: Record<string, Profile> = {};
  (uids || []).forEach((uid) => { if (store.profiles[uid]) out[uid] = clone(store.profiles[uid]); });
  return ok(out);
};

export function ensureProfile(authUser: AuthUser): Promise<Profile> {
  if (!store.profiles[authUser.uid]) {
    store.profiles[authUser.uid] = {
      uid: authUser.uid, name: authUser.displayName || 'You', email: authUser.email || '',
      photoURL: authUser.photoURL || null, heightM: null,
    };
  } else if (authUser.photoURL && !store.profiles[authUser.uid].photoURL) {
    store.profiles[authUser.uid].photoURL = authUser.photoURL;
  }
  return ok(clone(store.profiles[authUser.uid]));
}

// No dashboard fan-out: members store only uid/role/joinedAt (see
// lib/dashboards.js memberList), so a profile edit needs no propagation —
// every view re-derives name/height/etc. live on its next fetch.
export function updateProfile(uid: string, patch: Partial<Profile>): Promise<void> {
  store.profiles[uid] = { ...store.profiles[uid], ...patch };
  return ok();
}

// ---- weights (self-only) ------------------------------------------------
export const listWeights = (uid: string): Promise<WeightEntry[]> =>
  ok(clone(store.weights[uid] || []).sort((a, b) => (a.date < b.date ? 1 : -1)));

export function addWeight(uid: string, { date, kg, note = '' }: { date: string; kg: number; note?: string }): Promise<void> {
  store.weights[uid] = store.weights[uid] || [];
  const existing = store.weights[uid].find((e) => e.date === date);
  if (existing) { existing.kg = +kg; existing.note = note; }
  else store.weights[uid].push({ id: rid('w'), date, kg: +kg, note });
  bumpForUser(uid);
  return ok();
}

export function addWeights(uid: string, entries: Array<{ date: string; kg: number; note?: string }>): Promise<number> {
  entries.forEach((e) => {
    store.weights[uid] = store.weights[uid] || [];
    const ex = store.weights[uid].find((w) => w.date === e.date);
    if (ex) { ex.kg = +e.kg; ex.note = e.note || ''; }
    else store.weights[uid].push({ id: rid('w'), date: e.date, kg: +e.kg, note: e.note || '' });
  });
  bumpForUser(uid);
  return ok(entries.length);
}

export function updateWeight(uid: string, id: string, patch: Partial<WeightEntry>): Promise<void> {
  const list = store.weights[uid] || [];
  const e = list.find((w) => w.id === id || w.date === id);
  if (!e) return ok();
  if (patch.date && patch.date !== e.date) {
    const collision = list.find((w) => w !== e && w.date === patch.date);
    if (collision) throw new Error(`An entry already exists on ${patch.date}.`);
  }
  Object.assign(e, patch);
  bumpForUser(uid);
  return ok();
}

export function deleteWeight(uid: string, id: string): Promise<void> {
  store.weights[uid] = (store.weights[uid] || []).filter((w) => w.id !== id && w.date !== id);
  bumpForUser(uid);
  return ok();
}

// ---- dashboards ---------------------------------------------------------
export const listDashboards = (uid: string): Promise<Dashboard[]> =>
  ok(clone(store.dashboards.filter((d) => d.members[uid])));

export const getDashboard = (id: string): Promise<Dashboard | null> => {
  const d = store.dashboards.find((x) => x.id === id);
  return ok(d ? clone(d) : null);
};

export function createDashboard(uid: string, { name, teamGoalLabel, teamGoalTarget }: { name?: string; teamGoalLabel?: string | null; teamGoalTarget?: number | string }): Promise<Dashboard> {
  const id = rid('dash');
  const d: Dashboard = {
    id, name: name || 'New dashboard', ownerUid: uid, createdAt: Date.now(), updatedAt: Date.now(),
    members: { [uid]: { uid, role: 'owner', joinedAt: Date.now() } },
    trackedUids: [uid],
    goals: {},
    teamGoal: teamGoalLabel ? { label: teamGoalLabel, target: Number(teamGoalTarget) || 10 } : null,
    habits: [],
    public: { enabled: false, token: null },
  };
  store.dashboards.unshift(d);
  return ok(clone(d));
}

export function updateDashboard(id: string, patch: Partial<Dashboard>): Promise<void> {
  const d = store.dashboards.find((x) => x.id === id);
  if (d) { Object.assign(d, patch); d.updatedAt = Date.now(); }
  return ok();
}

export function updateMemberRole(id: string, uid: string, role: Role): Promise<void> {
  const d = store.dashboards.find((x) => x.id === id);
  if (d?.members?.[uid]) { d.members[uid].role = role; d.updatedAt = Date.now(); }
  return ok();
}

// Used both for "owner removes someone else" and "a member leaves (removes
// themselves)" — same shape as firestore.js's removeMember.
export function removeMember(id: string, uid: string): Promise<void> {
  const d = store.dashboards.find((x) => x.id === id);
  if (d) {
    delete d.members[uid];
    d.trackedUids = d.trackedUids.filter((u) => u !== uid);
    d.updatedAt = Date.now();
  }
  return ok();
}

export function deleteDashboard(id: string): Promise<void> {
  store.dashboards = store.dashboards.filter((x) => x.id !== id);
  delete store.habitLogs[id];
  delete store.nsv[id];
  return ok();
}

export const getDashboardSeries = (id: string): Promise<Record<string, SeriesPoint[]>> => {
  const d = store.dashboards.find((x) => x.id === id);
  if (!d) return ok({});
  const out: Record<string, SeriesPoint[]> = {};
  d.trackedUids.forEach((uid) => { out[uid] = trackedSeries(uid); });
  return ok(out);
};

// ---- habits -------------------------------------------------------------
export const getHabitLogs = (id: string): Promise<Record<string, Record<string, HabitLog>>> =>
  ok(clone(store.habitLogs[id] || {}));

export function setHabitMark(id: string, uid: string, habitId: string, date: string, value: HabitMark | 0 | null | undefined): Promise<void> {
  store.habitLogs[id] = store.habitLogs[id] || {};
  store.habitLogs[id][uid] = store.habitLogs[id][uid] || {};
  store.habitLogs[id][uid][habitId] = store.habitLogs[id][uid][habitId] || {};
  if (value) {
    store.habitLogs[id][uid][habitId][date] = value;
    store.habitLogs[id][uid][habitId] = applyAutoGrace(store.habitLogs[id][uid][habitId], date);
  } else delete store.habitLogs[id][uid][habitId][date];
  const d = store.dashboards.find((x) => x.id === id);
  if (d) d.updatedAt = Date.now();
  return ok();
}

// ---- NSV notes ----------------------------------------------------------
export const listNsv = (id: string): Promise<Record<string, Nsv[]>> => ok(clone(store.nsv[id] || {}));

export function addNsv(id: string, uid: string, { date, text }: { date?: string | null; text: string }): Promise<void> {
  store.nsv[id] = store.nsv[id] || {};
  store.nsv[id][uid] = store.nsv[id][uid] || [];
  store.nsv[id][uid].unshift({ id: rid('nsv'), date: date || todayISO(), text });
  const d = store.dashboards.find((x) => x.id === id);
  if (d) d.updatedAt = Date.now();
  return ok();
}

export function deleteNsv(dashboardId: string, noteId: string): Promise<void> {
  const byUid = store.nsv[dashboardId] || {};
  Object.keys(byUid).forEach((uid) => { byUid[uid] = byUid[uid].filter((n) => n.id !== noteId); });
  const d = store.dashboards.find((x) => x.id === dashboardId);
  if (d) d.updatedAt = Date.now();
  return ok();
}

// ---- invites ------------------------------------------------------------
export const listInvites = (email: string): Promise<Invite[]> =>
  ok(clone(store.invites.filter((i) => i.toEmail === email && i.status === 'pending')));

export const listOutgoing = (dashboardId: string): Promise<Invite[]> =>
  ok(clone(store.invites.filter((i) => i.dashboardId === dashboardId)));

export function createInvite(dashboardId: string, { fromUid, fromName, toEmail, role }: { fromUid: string; fromName: string; toEmail: string; role?: Role }): Promise<Invite> {
  const d = store.dashboards.find((x) => x.id === dashboardId);
  const inv: Invite = { id: rid('inv'), dashboardId, dashboardName: d?.name || 'a dashboard', fromUid, fromName, toEmail, role: role || 'editor', status: 'pending', createdAt: Date.now() };
  store.invites.push(inv);
  return ok(clone(inv));
}

export function acceptInvite(inviteId: string, authUser: AuthUser): Promise<void> {
  const inv = store.invites.find((i) => i.id === inviteId);
  if (!inv) return ok();
  inv.status = 'accepted';
  let d = store.dashboards.find((x) => x.id === inv.dashboardId);
  if (!d) {
    // demo/test fixture: materialize the inviter's dashboard so it shows in
    // our account too. The inviter's own profile (name/photo/height) is
    // whatever's already in store.profiles — nothing to copy here.
    d = {
      id: inv.dashboardId, name: inv.dashboardName, ownerUid: inv.fromUid, createdAt: Date.now(), updatedAt: Date.now(),
      members: { [inv.fromUid]: { uid: inv.fromUid, role: 'owner', joinedAt: Date.now() } },
      trackedUids: [inv.fromUid], goals: {}, teamGoal: null, habits: [], public: { enabled: false, token: null },
    };
    store.dashboards.unshift(d);
  }
  d.members[authUser.uid] = { uid: authUser.uid, role: inv.role, joinedAt: Date.now() };
  if (!d.trackedUids.includes(authUser.uid)) d.trackedUids.push(authUser.uid);
  d.updatedAt = Date.now();
  return ok();
}

export function declineInvite(inviteId: string): Promise<void> {
  const inv = store.invites.find((i) => i.id === inviteId);
  if (inv) inv.status = 'declined';
  return ok();
}

export function cancelInvite(inviteId: string): Promise<void> {
  store.invites = store.invites.filter((i) => i.id !== inviteId);
  return ok();
}

// ---- sharing / public ---------------------------------------------------
export function setPublicLink(dashboardId: string, enabled: boolean): Promise<PublicLink> {
  const d = store.dashboards.find((x) => x.id === dashboardId);
  if (!d) return ok({ enabled: false, token: null });
  d.public = enabled ? { enabled: true, token: d.public?.token || rid('tok') } : { enabled: false, token: null };
  d.updatedAt = Date.now();
  return ok(clone(d.public));
}

export function getPublicView(token: string): Promise<PublicView | null> {
  const d = store.dashboards.find((x) => x.public?.enabled && x.public?.token === token);
  if (!d) return ok(null);
  const series: Record<string, SeriesPoint[]> = {};
  d.trackedUids.forEach((uid) => { series[uid] = trackedSeries(uid); });
  // Anonymous public-link visitors have no live profile access, so — unlike
  // every signed-in view — this is the one place members are enriched into
  // storage-shaped output rather than left as bare uid/role/joinedAt.
  const profiles: Record<string, Profile> = {};
  Object.keys(d.members).forEach((uid) => { if (store.profiles[uid]) profiles[uid] = store.profiles[uid]; });
  const members: Record<string, PublicMember> = Object.fromEntries(memberList(d, profiles).map((m): [string, PublicMember] => [m.uid, {
    uid: m.uid, role: m.role, joinedAt: m.joinedAt, name: m.name, photoURL: m.photoURL, heightM: m.heightM, color: m.color, initial: m.initial,
  }]));
  return ok(clone({
    id: d.id, name: d.name, members, trackedUids: d.trackedUids,
    goals: d.goals, teamGoal: d.teamGoal, habits: d.habits,
    series, habitLogs: store.habitLogs[d.id] || {}, nsv: store.nsv[d.id] || {},
  }));
}

// ---- notifications (derived) -------------------------------------------
export function listNotifications(uid: string): Promise<Notification[]> {
  const profile = store.profiles[uid];
  const out: Notification[] = [];
  store.invites.filter((i) => i.toEmail === profile?.email && i.status === 'pending').forEach((i) => {
    out.push({ id: `n_${i.id}`, text: `${i.fromName} invited you to “${i.dashboardName}”.`, sub: 'Respond from your dashboards list.', when: i.createdAt, unread: true });
  });
  out.push({ id: 'n_welcome', text: 'Welcome to WeightTracker.', sub: 'Log your weight and start a shared dashboard.', when: Date.now() - 3 * 86400000, unread: false });
  return ok(out);
}

// Compile-time proof this module mirrors the same contract as firestore.ts
// (see repo.ts) — either backend drifting from `DataRepo`'s shape now fails
// `tsc` instead of surfacing as a runtime bug in production or tests only.
export const _dataRepoConformance = {
  getProfile, getProfiles, ensureProfile, updateProfile,
  listWeights, addWeight, addWeights, updateWeight, deleteWeight,
  listDashboards, getDashboard, createDashboard, updateDashboard, updateMemberRole, removeMember, deleteDashboard, getDashboardSeries,
  getHabitLogs, setHabitMark,
  listNsv, addNsv, deleteNsv,
  listInvites, listOutgoing, createInvite, acceptInvite, declineInvite, cancelInvite,
  setPublicLink, getPublicView,
  listNotifications,
} satisfies DataRepo;
