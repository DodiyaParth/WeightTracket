// In-memory backend (demo mode + reference implementation). Same async API as
// the Firestore backend. Weight series for a dashboard are derived from each
// member's canonical weights, so logging a weigh-in reflects everywhere.
import { bus } from './bus.js';
import { buildSeed } from './seed.js';
import { todayISO } from '../lib/date.js';
import { initials } from '../lib/colors.js';
import { memberList } from '../lib/dashboards.js';
import { applyAutoGrace } from '../lib/habits.js';

let store = buildSeed();
export function _resetStore() { store = buildSeed(); } // for tests

const clone = (x) => JSON.parse(JSON.stringify(x));
const rid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const ok = (v) => Promise.resolve(v);
const changed = () => bus.emit();

const trackedSeries = (uid) => (store.weights[uid] || []).map((e) => ({ date: e.date, kg: e.kg }));
const bumpForUser = (uid) => {
  store.dashboards.forEach((d) => { if (d.trackedUids.includes(uid)) d.updatedAt = Date.now(); });
};

// ---- profile ------------------------------------------------------------
export const getProfile = (uid) => ok(store.profiles[uid] ? clone(store.profiles[uid]) : null);

export const getProfiles = (uids) => {
  const out = {};
  (uids || []).forEach((uid) => { if (store.profiles[uid]) out[uid] = clone(store.profiles[uid]); });
  return ok(out);
};

export function ensureProfile(authUser) {
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
export function updateProfile(uid, patch) {
  store.profiles[uid] = { ...store.profiles[uid], ...patch };
  changed();
  return ok();
}

// ---- weights (self-only) ------------------------------------------------
export const listWeights = (uid) =>
  ok(clone(store.weights[uid] || []).sort((a, b) => (a.date < b.date ? 1 : -1)));

export function addWeight(uid, { date, kg, note = '' }) {
  store.weights[uid] = store.weights[uid] || [];
  const existing = store.weights[uid].find((e) => e.date === date);
  if (existing) { existing.kg = +kg; existing.note = note; }
  else store.weights[uid].push({ id: rid('w'), date, kg: +kg, note });
  bumpForUser(uid);
  changed();
  return ok();
}

export function addWeights(uid, entries) {
  entries.forEach((e) => {
    store.weights[uid] = store.weights[uid] || [];
    const ex = store.weights[uid].find((w) => w.date === e.date);
    if (ex) { ex.kg = +e.kg; ex.note = e.note || ''; }
    else store.weights[uid].push({ id: rid('w'), date: e.date, kg: +e.kg, note: e.note || '' });
  });
  bumpForUser(uid);
  changed();
  return ok(entries.length);
}

export function updateWeight(uid, id, patch) {
  const list = store.weights[uid] || [];
  const e = list.find((w) => w.id === id || w.date === id);
  if (!e) return ok();
  if (patch.date && patch.date !== e.date) {
    const collision = list.find((w) => w !== e && w.date === patch.date);
    if (collision) throw new Error(`An entry already exists on ${patch.date}.`);
  }
  Object.assign(e, patch);
  bumpForUser(uid);
  changed();
  return ok();
}

export function deleteWeight(uid, id) {
  store.weights[uid] = (store.weights[uid] || []).filter((w) => w.id !== id && w.date !== id);
  bumpForUser(uid);
  changed();
  return ok();
}

// ---- dashboards ---------------------------------------------------------
export const listDashboards = (uid) =>
  ok(clone(store.dashboards.filter((d) => d.members[uid])));

export const getDashboard = (id) => {
  const d = store.dashboards.find((x) => x.id === id);
  return ok(d ? clone(d) : null);
};

export function createDashboard(uid, { name, teamGoalLabel, teamGoalTarget }) {
  const id = rid('dash');
  const d = {
    id, name: name || 'New dashboard', ownerUid: uid, createdAt: Date.now(), updatedAt: Date.now(),
    members: { [uid]: { uid, role: 'owner', joinedAt: Date.now() } },
    trackedUids: [uid],
    goals: {},
    teamGoal: teamGoalLabel ? { label: teamGoalLabel, target: Number(teamGoalTarget) || 10 } : null,
    habits: [],
    public: { enabled: false, token: null },
  };
  store.dashboards.unshift(d);
  changed();
  return ok(clone(d));
}

export function updateDashboard(id, patch) {
  const d = store.dashboards.find((x) => x.id === id);
  if (d) { Object.assign(d, patch); d.updatedAt = Date.now(); }
  changed();
  return ok();
}

export function updateMemberRole(id, uid, role) {
  const d = store.dashboards.find((x) => x.id === id);
  if (d?.members?.[uid]) { d.members[uid].role = role; d.updatedAt = Date.now(); }
  changed();
  return ok();
}

// Used both for "owner removes someone else" and "a member leaves (removes
// themselves)" — same shape as firestore.js's removeMember.
export function removeMember(id, uid) {
  const d = store.dashboards.find((x) => x.id === id);
  if (d) {
    delete d.members[uid];
    d.trackedUids = d.trackedUids.filter((u) => u !== uid);
    d.updatedAt = Date.now();
  }
  changed();
  return ok();
}

export function deleteDashboard(id) {
  store.dashboards = store.dashboards.filter((x) => x.id !== id);
  delete store.habitLogs[id];
  delete store.nsv[id];
  changed();
  return ok();
}

export const getDashboardSeries = (id) => {
  const d = store.dashboards.find((x) => x.id === id);
  if (!d) return ok({});
  const out = {};
  d.trackedUids.forEach((uid) => { out[uid] = trackedSeries(uid); });
  return ok(out);
};

// ---- habits -------------------------------------------------------------
export const getHabitLogs = (id) => ok(clone(store.habitLogs[id] || {}));

export function setHabitMark(id, uid, habitId, date, value) {
  store.habitLogs[id] = store.habitLogs[id] || {};
  store.habitLogs[id][uid] = store.habitLogs[id][uid] || {};
  store.habitLogs[id][uid][habitId] = store.habitLogs[id][uid][habitId] || {};
  if (value) {
    store.habitLogs[id][uid][habitId][date] = value;
    store.habitLogs[id][uid][habitId] = applyAutoGrace(store.habitLogs[id][uid][habitId], date);
  } else delete store.habitLogs[id][uid][habitId][date];
  const d = store.dashboards.find((x) => x.id === id);
  if (d) d.updatedAt = Date.now();
  changed();
  return ok();
}

// ---- NSV notes ----------------------------------------------------------
export const listNsv = (id) => ok(clone(store.nsv[id] || {}));

export function addNsv(id, uid, { date, text }) {
  store.nsv[id] = store.nsv[id] || {};
  store.nsv[id][uid] = store.nsv[id][uid] || [];
  store.nsv[id][uid].unshift({ id: rid('nsv'), date: date || todayISO(), text });
  const d = store.dashboards.find((x) => x.id === id);
  if (d) d.updatedAt = Date.now();
  changed();
  return ok();
}

export function deleteNsv(dashboardId, noteId) {
  const byUid = store.nsv[dashboardId] || {};
  Object.keys(byUid).forEach((uid) => { byUid[uid] = byUid[uid].filter((n) => n.id !== noteId); });
  const d = store.dashboards.find((x) => x.id === dashboardId);
  if (d) d.updatedAt = Date.now();
  changed();
  return ok();
}

// ---- invites ------------------------------------------------------------
export const listInvites = (email) =>
  ok(clone(store.invites.filter((i) => i.toEmail === email && i.status === 'pending')));

export const listOutgoing = (dashboardId) =>
  ok(clone(store.invites.filter((i) => i.dashboardId === dashboardId)));

export function createInvite(dashboardId, { fromUid, fromName, toEmail, role }) {
  const inv = { id: rid('inv'), dashboardId, fromUid, fromName, fromInitial: initials(fromName), toEmail, role: role || 'editor', status: 'pending', createdAt: Date.now() };
  const d = store.dashboards.find((x) => x.id === dashboardId);
  inv.dashboardName = d?.name || 'a dashboard';
  store.invites.push(inv);
  changed();
  return ok(clone(inv));
}

export function acceptInvite(inviteId, authUser) {
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
  changed();
  return ok();
}

export function declineInvite(inviteId) {
  const inv = store.invites.find((i) => i.id === inviteId);
  if (inv) inv.status = 'declined';
  changed();
  return ok();
}

export function cancelInvite(inviteId) {
  store.invites = store.invites.filter((i) => i.id !== inviteId);
  changed();
  return ok();
}

// ---- sharing / public ---------------------------------------------------
export function setPublicLink(dashboardId, enabled) {
  const d = store.dashboards.find((x) => x.id === dashboardId);
  if (!d) return ok({ enabled: false, token: null });
  d.public = enabled ? { enabled: true, token: d.public?.token || rid('tok') } : { enabled: false, token: null };
  d.updatedAt = Date.now();
  changed();
  return ok(clone(d.public));
}

export function getPublicView(token) {
  const d = store.dashboards.find((x) => x.public?.enabled && x.public?.token === token);
  if (!d) return ok(null);
  const series = {};
  d.trackedUids.forEach((uid) => { series[uid] = trackedSeries(uid); });
  // Anonymous public-link visitors have no live profile access, so — unlike
  // every signed-in view — this is the one place members are enriched into
  // storage-shaped output rather than left as bare uid/role/joinedAt.
  const profiles = {};
  Object.keys(d.members).forEach((uid) => { if (store.profiles[uid]) profiles[uid] = store.profiles[uid]; });
  const members = Object.fromEntries(memberList(d, profiles).map((m) => [m.uid, {
    uid: m.uid, role: m.role, joinedAt: m.joinedAt, name: m.name, photoURL: m.photoURL, heightM: m.heightM, color: m.color, initial: m.initial,
  }]));
  return ok(clone({
    id: d.id, name: d.name, members, trackedUids: d.trackedUids,
    goals: d.goals, teamGoal: d.teamGoal, habits: d.habits,
    series, habitLogs: store.habitLogs[d.id] || {}, nsv: store.nsv[d.id] || {},
  }));
}

// ---- notifications (derived) -------------------------------------------
export function listNotifications(uid) {
  const profile = store.profiles[uid];
  const out = [];
  store.invites.filter((i) => i.toEmail === profile?.email && i.status === 'pending').forEach((i) => {
    out.push({ id: `n_${i.id}`, text: `${i.fromName} invited you to “${i.dashboardName}”.`, sub: 'Respond from your dashboards list.', when: i.createdAt, unread: true });
  });
  out.push({ id: 'n_welcome', text: 'Welcome to WeightTracker.', sub: 'Log your weight and start a shared dashboard.', when: Date.now() - 3 * 86400000, unread: false });
  return ok(out);
}
