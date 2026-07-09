// Firestore backend (production). Mirrors the memory backend's async API.
//
// Data model (see REQUIREMENTS §3 and firestore.rules):
//   users/{uid}                         profile  (self read/write)
//   users/{uid}/weights/{date}          weight entry (self read/write)  ← canonical, owner-only
//   dashboards/{id}                     dashboard (members map + memberUids array)
//   dashboards/{id}/series/{uid}        denormalized {date,kg} for display (self-write, member-read)
//   dashboards/{id}/habitLogs/{uid}     habit completions (self-write, member-read)
//   dashboards/{id}/nsv/{noteId}        non-scale-victory notes
//   invites/{id}                        collaboration invites (queried by toEmail)
//   publicViews/{token}                 world-readable snapshot for the no-login link
import {
  doc, collection, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, arrayUnion, arrayRemove, deleteField, writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { db as maybeDb } from '../firebase.js';
import { bus } from './bus.js';
import { initials } from '../lib/colors.js';
import { memberList } from '../lib/dashboards.js';
import { applyAutoGrace } from '../lib/habits.js';
import type {
  AuthUser, Dashboard, HabitLog, HabitMark, Invite, Notification, Nsv, Profile,
  PublicLink, PublicMember, PublicView, Role, SeriesPoint, WeightEntry,
} from '../types.js';

// This backend is only ever exercised once Firebase is configured (the memory
// backend covers the unconfigured/test path), so `db` is non-null here. The
// assertion keeps every call site clean; an unconfigured call throws exactly
// as it did before (doc(undefined, ...)).
const db = maybeDb as Firestore;

const changed = () => bus.emit();
// Cryptographically strong token (128 bits) for the world-readable public link
// — brute-forceable random ids are not acceptable once anyone with the string
// gets a read (DEV-6).
const rid = (p = 'tok'): string =>
  `${p}_${Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')}`;

// ---- profile ------------------------------------------------------------
export async function getProfile(uid: string): Promise<Profile | null> {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? (s.data() as Profile) : null;
}

// Batch profile fetch — how dashboard UI joins live name/email/photoURL/heightM
// against the members map (which stores only uid/role/joinedAt; see lib/dashboards.js).
export async function getProfiles(uids?: string[] | null): Promise<Record<string, Profile>> {
  const unique = Array.from(new Set(uids || []));
  const snaps = await Promise.all(unique.map((uid) => getDoc(doc(db, 'users', uid))));
  const out: Record<string, Profile> = {};
  snaps.forEach((s, i) => { if (s.exists()) out[unique[i]] = s.data() as Profile; });
  return out;
}

export async function ensureProfile(authUser: AuthUser): Promise<Profile> {
  const ref = doc(db, 'users', authUser.uid);
  const s = await getDoc(ref);
  if (!s.exists()) {
    const profile = {
      uid: authUser.uid, name: authUser.displayName || 'You', email: authUser.email || '',
      photoURL: authUser.photoURL || null, heightM: null, createdAt: Date.now(),
    };
    await setDoc(ref, profile);
    return profile;
  }
  // keep photo fresh
  if (authUser.photoURL && s.data().photoURL !== authUser.photoURL) {
    await updateDoc(ref, { photoURL: authUser.photoURL });
  }
  return s.data() as Profile;
}

// No dashboard fan-out needed: dashboards never store a copy of name/height/etc
// (see lib/dashboards.js memberList) — every view that shows them re-derives
// live from this document, so a profile edit is visible everywhere on its own
// next fetch (the bus emit below is what triggers that refetch).
export async function updateProfile(uid: string, patch: Partial<Profile>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), patch);
  changed();
}

// ---- weights (self-only) + series fan-out -------------------------------
export async function listWeights(uid: string): Promise<WeightEntry[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'weights'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WeightEntry)).sort((a, b) => (a.date < b.date ? 1 : -1));
}

async function seriesEntriesFor(uid: string): Promise<SeriesPoint[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'weights'));
  return snap.docs.map((d) => ({ date: d.data().date, kg: d.data().kg })).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Push a member's public (date,kg) projection into every dashboard that tracks
// them, and refresh any public snapshot. Keeps weight owner-write only.
//
// Each dashboard's fan-out is isolated in its own try/catch: one dashboard
// rejecting (rules, a mid-delete, a network blip) must never fail the user's
// own weigh-in save (DEV-4).
async function fanOutSeries(uid: string): Promise<void> {
  const entries = await seriesEntriesFor(uid);
  const snap = await getDocs(query(collection(db, 'dashboards'), where('memberUids', 'array-contains', uid)));
  await Promise.all(snap.docs.map(async (ds) => {
    try {
      const d = ds.data();
      if (!(d.trackedUids || []).includes(uid)) return;
      await setDoc(doc(db, 'dashboards', ds.id, 'series', uid), { uid, entries, updatedAt: Date.now() });
      await updateDoc(doc(db, 'dashboards', ds.id), { updatedAt: Date.now() });
      if (d.public?.enabled && d.public?.token) await rebuildPublic(ds.id);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[WeightTracker] fan-out to dashboard ${ds.id} failed:`, e);
    }
  }));
}

export async function addWeight(uid: string, { date, kg, note = '' }: { date: string; kg: number; note?: string }): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'weights', date), { date, kg: +kg, note, updatedAt: Date.now() });
  await fanOutSeries(uid);
  changed();
}

export async function addWeights(uid: string, entries: Array<{ date: string; kg: number; note?: string }>): Promise<number> {
  await Promise.all(entries.map((e) =>
    setDoc(doc(db, 'users', uid, 'weights', e.date), { date: e.date, kg: +e.kg, note: e.note || '', updatedAt: Date.now() })));
  await fanOutSeries(uid);
  changed();
  return entries.length;
}

// Weight docs are keyed by date, so changing the date means moving the doc
// (delete-old + set-new), not just patching a field — otherwise the doc id and
// its `date` field disagree and a later add on the old date silently collides.
export async function updateWeight(uid: string, id: string, patch: Partial<WeightEntry>): Promise<void> {
  if (patch.date && patch.date !== id) {
    const oldRef = doc(db, 'users', uid, 'weights', id);
    const newRef = doc(db, 'users', uid, 'weights', patch.date);
    const [oldSnap, newSnap] = await Promise.all([getDoc(oldRef), getDoc(newRef)]);
    if (newSnap.exists()) throw new Error(`An entry already exists on ${patch.date}.`);
    const merged = { ...(oldSnap.exists() ? oldSnap.data() : {}), ...patch, date: patch.date, updatedAt: Date.now() };
    await setDoc(newRef, merged);
    await deleteDoc(oldRef);
  } else {
    await updateDoc(doc(db, 'users', uid, 'weights', id), patch);
  }
  await fanOutSeries(uid);
  changed();
}

export async function deleteWeight(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'weights', id));
  await fanOutSeries(uid);
  changed();
}

// ---- dashboards ---------------------------------------------------------
export async function listDashboards(uid: string): Promise<Dashboard[]> {
  const snap = await getDocs(query(collection(db, 'dashboards'), where('memberUids', 'array-contains', uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Dashboard));
}

export async function getDashboard(id: string): Promise<Dashboard | null> {
  const s = await getDoc(doc(db, 'dashboards', id));
  return s.exists() ? ({ id: s.id, ...s.data() } as Dashboard) : null;
}

export async function createDashboard(uid: string, { name, teamGoalLabel, teamGoalTarget }: { name?: string; teamGoalLabel?: string | null; teamGoalTarget?: number | string }): Promise<Dashboard> {
  const data = {
    name: name || 'New dashboard', ownerUid: uid, createdAt: Date.now(), updatedAt: Date.now(),
    memberUids: [uid],
    members: { [uid]: { uid, role: 'owner' as const, joinedAt: Date.now() } },
    trackedUids: [uid],
    goals: {},
    teamGoal: teamGoalLabel ? { label: teamGoalLabel, target: Number(teamGoalTarget) || 10 } : null,
    habits: [],
    public: { enabled: false, token: null },
  };
  const ref = await addDoc(collection(db, 'dashboards'), data);
  await setDoc(doc(db, 'dashboards', ref.id, 'series', uid), { uid, entries: await seriesEntriesFor(uid), updatedAt: Date.now() });
  changed();
  return { id: ref.id, ...data };
}

// The public snapshot is a side effect of a save, never the point of it — a
// hiccup rebuilding it (or a transient permission blip) must never fail the
// goal/habit/role edit that triggered it. Same defensive pattern as
// fanOutSeries's per-dashboard try/catch.
async function safeRebuildPublic(dashboardId: string): Promise<void> {
  try { await rebuildPublic(dashboardId); } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[WeightTracker] public snapshot rebuild for ${dashboardId} failed:`, e);
  }
}

export async function updateDashboard(id: string, patch: Partial<Dashboard>): Promise<void> {
  await updateDoc(doc(db, 'dashboards', id), { ...patch, updatedAt: Date.now() });
  const d = await getDashboard(id);
  if (d?.public?.enabled) await safeRebuildPublic(id);
  changed();
}

// A field-path update, not a whole-members-map rewrite (DEV-17) — a role
// change and a concurrent join/role-change from someone else can't clobber
// each other. Owner-only per firestore.rules (editors may not touch membership).
export async function updateMemberRole(id: string, uid: string, role: Role): Promise<void> {
  await updateDoc(doc(db, 'dashboards', id), { [`members.${uid}.role`]: role, updatedAt: Date.now() });
  const d = await getDashboard(id);
  if (d?.public?.enabled) await safeRebuildPublic(id);
  changed();
}

// Used both for "owner removes someone else" and "a member leaves (removes
// themselves)" — the same shape either way; firestore.rules' isOwner()/
// selfLeaving() decide which callers are actually allowed to do it (DEV-7).
export async function removeMember(id: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'dashboards', id), {
    memberUids: arrayRemove(uid),
    trackedUids: arrayRemove(uid),
    [`members.${uid}`]: deleteField(),
    updatedAt: Date.now(),
  });
  const d = await getDashboard(id);
  if (d?.public?.enabled) await safeRebuildPublic(id);
  changed();
}

// Owner-only (see firestore.rules). Cleans up every subcollection doc and the
// public snapshot, not just the dashboard doc itself, so deleting doesn't
// leave orphaned series/habitLogs/nsv data behind.
export async function deleteDashboard(id: string): Promise<void> {
  const d = await getDashboard(id);
  const [seriesSnap, habitLogsSnap, nsvSnap] = await Promise.all([
    getDocs(collection(db, 'dashboards', id, 'series')),
    getDocs(collection(db, 'dashboards', id, 'habitLogs')),
    getDocs(collection(db, 'dashboards', id, 'nsv')),
  ]);
  const batch = writeBatch(db);
  seriesSnap.docs.forEach((s) => batch.delete(s.ref));
  habitLogsSnap.docs.forEach((s) => batch.delete(s.ref));
  nsvSnap.docs.forEach((s) => batch.delete(s.ref));
  if (d?.public?.token) batch.delete(doc(db, 'publicViews', d.public.token));
  batch.delete(doc(db, 'dashboards', id));
  await batch.commit();
  changed();
}

export async function getDashboardSeries(id: string): Promise<Record<string, SeriesPoint[]>> {
  const snap = await getDocs(collection(db, 'dashboards', id, 'series'));
  const out: Record<string, SeriesPoint[]> = {};
  snap.docs.forEach((d) => { out[d.id] = d.data().entries || []; });
  return out;
}

// ---- habits -------------------------------------------------------------
export async function getHabitLogs(id: string): Promise<Record<string, Record<string, HabitLog>>> {
  const snap = await getDocs(collection(db, 'dashboards', id, 'habitLogs'));
  const out: Record<string, Record<string, HabitLog>> = {};
  snap.docs.forEach((d) => { out[d.id] = d.data().habits || {}; });
  return out;
}

export async function setHabitMark(id: string, uid: string, habitId: string, date: string, value: HabitMark | 0 | null | undefined): Promise<void> {
  const ref = doc(db, 'dashboards', id, 'habitLogs', uid);
  const s = await getDoc(ref);
  const habits = s.exists() ? s.data().habits || {} : {};
  habits[habitId] = habits[habitId] || {};
  if (value) { habits[habitId][date] = value; habits[habitId] = applyAutoGrace(habits[habitId], date); }
  else delete habits[habitId][date];
  await setDoc(ref, { uid, habits, updatedAt: Date.now() });
  await updateDoc(doc(db, 'dashboards', id), { updatedAt: Date.now() });
  const d = await getDashboard(id);
  if (d?.public?.enabled) await safeRebuildPublic(id);
  changed();
}

// ---- NSV ----------------------------------------------------------------
export async function listNsv(id: string): Promise<Record<string, Nsv[]>> {
  const snap = await getDocs(collection(db, 'dashboards', id, 'nsv'));
  const out: Record<string, Nsv[]> = {};
  snap.docs.forEach((d) => {
    const n = d.data();
    out[n.uid] = out[n.uid] || [];
    out[n.uid].push({ id: d.id, date: n.date, text: n.text });
  });
  Object.values(out).forEach((arr) => arr.sort((a, b) => (a.date < b.date ? 1 : -1)));
  return out;
}

export async function addNsv(id: string, uid: string, { date, text }: { date?: string | null; text: string }): Promise<void> {
  await addDoc(collection(db, 'dashboards', id, 'nsv'), { uid, date, text, createdAt: Date.now() });
  await updateDoc(doc(db, 'dashboards', id), { updatedAt: Date.now() });
  changed();
}

export async function deleteNsv(dashboardId: string, noteId: string): Promise<void> {
  await deleteDoc(doc(db, 'dashboards', dashboardId, 'nsv', noteId));
  await updateDoc(doc(db, 'dashboards', dashboardId), { updatedAt: Date.now() });
  changed();
}

// ---- invites ------------------------------------------------------------
export async function listInvites(email: string): Promise<Invite[]> {
  const snap = await getDocs(query(collection(db, 'invites'), where('toEmail', '==', email), where('status', '==', 'pending')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invite));
}

export async function listOutgoing(dashboardId: string): Promise<Invite[]> {
  const snap = await getDocs(query(collection(db, 'invites'), where('dashboardId', '==', dashboardId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invite));
}

// Keyed `{dashboardId}_{toEmail}` — not an opaque auto-id — so the dashboard
// join rule can look up "is there a real pending invite for this email on
// this dashboard" directly, without a query (see firestore.rules selfJoining).
// A repeat invite to the same person overwrites the prior one; that's fine.
export async function createInvite(dashboardId: string, { fromUid, fromName, toEmail, role }: { fromUid: string; fromName: string; toEmail: string; role?: Role }): Promise<Invite> {
  const d = await getDashboard(dashboardId);
  const email = (toEmail || '').toLowerCase().trim();
  const data = { dashboardId, dashboardName: d?.name || 'a dashboard', fromUid, fromName, fromInitial: initials(fromName), toEmail: email, role: role || 'editor', status: 'pending' as const, createdAt: Date.now() };
  const id = `${dashboardId}_${email}`;
  await setDoc(doc(db, 'invites', id), data);
  changed();
  return { id, ...data };
}

// All three writes commit atomically (DEV-14) — a mid-sequence failure used to
// be able to leave a half-joined state (member added but no series, or joined
// but the invite still showing as pending).
export async function acceptInvite(inviteId: string, authUser: AuthUser): Promise<void> {
  const inviteRef = doc(db, 'invites', inviteId);
  const inv = (await getDoc(inviteRef)).data();
  if (!inv) return;
  const entries = await seriesEntriesFor(authUser.uid);
  const memberKey = `members.${authUser.uid}`;
  const batch = writeBatch(db);
  batch.update(doc(db, 'dashboards', inv.dashboardId), {
    memberUids: arrayUnion(authUser.uid),
    trackedUids: arrayUnion(authUser.uid),
    [memberKey]: { uid: authUser.uid, role: inv.role, joinedAt: Date.now() },
    updatedAt: Date.now(),
  });
  batch.set(doc(db, 'dashboards', inv.dashboardId, 'series', authUser.uid), { uid: authUser.uid, entries, updatedAt: Date.now() });
  batch.update(inviteRef, { status: 'accepted' });
  await batch.commit();
  changed();
}

export async function declineInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(db, 'invites', inviteId), { status: 'declined' });
  changed();
}

export async function cancelInvite(inviteId: string): Promise<void> {
  await deleteDoc(doc(db, 'invites', inviteId));
  changed();
}

// ---- sharing / public ---------------------------------------------------
// The one place a member-profile join gets materialized into storage: an
// anonymous public-link visitor has no live read access to `users/{uid}`
// (owner-only), so unlike every signed-in view this can't derive names/BMI at
// render time. Refreshed on every write that could change it (see call sites
// below) — never trusted as a live source, and never carries email (DEV-6).
async function rebuildPublic(dashboardId: string): Promise<void> {
  const d = await getDashboard(dashboardId);
  if (!d?.public?.token) return;
  const [series, habitLogs, nsv, profiles] = await Promise.all([
    getDashboardSeries(dashboardId), getHabitLogs(dashboardId), listNsv(dashboardId),
    getProfiles(Object.keys(d.members || {})),
  ]);
  const members: Record<string, PublicMember> = Object.fromEntries(memberList(d, profiles).map((m): [string, PublicMember] => [m.uid, {
    uid: m.uid, role: m.role, joinedAt: m.joinedAt, name: m.name, photoURL: m.photoURL, heightM: m.heightM, color: m.color, initial: m.initial,
  }]));
  await setDoc(doc(db, 'publicViews', d.public.token), {
    dashboardId, name: d.name, members, trackedUids: d.trackedUids,
    goals: d.goals, teamGoal: d.teamGoal, habits: d.habits, series, habitLogs, nsv,
    enabled: true, updatedAt: Date.now(),
  });
}

export async function setPublicLink(dashboardId: string, enabled: boolean): Promise<PublicLink> {
  const d = await getDashboard(dashboardId);
  if (enabled) {
    const token = d?.public?.token || rid('tok');
    await updateDoc(doc(db, 'dashboards', dashboardId), { public: { enabled: true, token }, updatedAt: Date.now() });
    await rebuildPublic(dashboardId);
    changed();
    return { enabled: true, token };
  }
  if (d?.public?.token) await deleteDoc(doc(db, 'publicViews', d.public.token)).catch(() => {});
  await updateDoc(doc(db, 'dashboards', dashboardId), { public: { enabled: false, token: null }, updatedAt: Date.now() });
  changed();
  return { enabled: false, token: null };
}

export async function getPublicView(token: string): Promise<PublicView | null> {
  const s = await getDoc(doc(db, 'publicViews', token));
  return s.exists() && s.data().enabled ? (s.data() as PublicView) : null;
}

// ---- notifications ------------------------------------------------------
export async function listNotifications(uid: string): Promise<Notification[]> {
  const profile = await getProfile(uid);
  const out: Notification[] = [];
  if (profile?.email) {
    const invs = await listInvites(profile.email);
    invs.forEach((i) => out.push({ id: `n_${i.id}`, text: `${i.fromName} invited you to “${i.dashboardName}”.`, sub: 'Respond from your dashboards list.', when: i.createdAt, unread: true }));
  }
  return out;
}
