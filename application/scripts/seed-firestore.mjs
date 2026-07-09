// Seeds a real Firestore project with the "demo world" (Parth & Priya + wider
// cast) so there's a shared default account with rich data for testing.
//
// Uses the Firebase ADMIN SDK because it writes documents owned by OTHER users
// (priya, arjun, ...) — a normal client can't do that (weight/series are
// self-write-only, see firestore.rules). The Admin SDK bypasses security rules
// entirely, which is exactly what a one-time seed script needs.
//
// Setup (one-time):
//   1. Firebase console → Project settings → Service accounts →
//      "Generate new private key" → save as application/serviceAccount.json
//      (already gitignored — this is a full-access credential, never commit it)
//   2. npm run seed
//
// Safe to re-run: every write uses .set() (upsert), so running this again just
// refreshes the seeded data instead of erroring or duplicating it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { buildSeed, DEMO_UID } from '../src/data/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The shared default test login — override via env vars if you want different
// credentials, otherwise this is what the team signs in with.
const DEFAULT_EMAIL = process.env.SEED_EMAIL || 'demo@weighttracker.app';
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'WeightTracker!Demo1';

function loadServiceAccount() {
  const p = path.join(__dirname, '..', 'serviceAccount.json');
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    console.error(
      `\nCouldn't read ${p}.\n` +
      'Download it from Firebase console → Project settings → Service accounts →\n' +
      '"Generate new private key", save it as application/serviceAccount.json, and re-run.\n'
    );
    process.exit(1);
  }
}

async function ensureDefaultAuthUser(auth) {
  try {
    const user = await auth.createUser({
      uid: DEMO_UID,
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD,
      displayName: 'Parth',
    });
    console.log(`Created auth user ${user.uid} <${DEFAULT_EMAIL}>`);
  } catch (e) {
    if (e.code === 'auth/uid-already-exists' || e.code === 'auth/email-already-exists') {
      console.log(`Auth user ${DEMO_UID} already exists — leaving credentials as-is.`);
    } else {
      throw e;
    }
  }
}

// { date, kg } pairs sorted ascending — the denormalized shape dashboards read
// (see firestore.js seriesEntriesFor / fanOutSeries).
const toSeries = (weights) =>
  [...weights].map((w) => ({ date: w.date, kg: w.kg })).sort((a, b) => (a.date < b.date ? -1 : 1));

async function main() {
  const serviceAccount = loadServiceAccount();
  initializeApp({ credential: cert(serviceAccount) });
  const auth = getAuth();
  const db = getFirestore();
  const seed = buildSeed();

  await ensureDefaultAuthUser(auth);

  const bulk = db.bulkWriter();

  // Profiles + canonical weight history (owner-only in the real rules; the
  // Admin SDK bypasses that to seed every person's own data).
  for (const [uid, profile] of Object.entries(seed.profiles)) {
    bulk.set(db.doc(`users/${uid}`), { ...profile, createdAt: Date.now() }, { merge: true });
    for (const w of seed.weights[uid] || []) {
      bulk.set(db.doc(`users/${uid}/weights/${w.date}`), { date: w.date, kg: w.kg, note: w.note || '', updatedAt: Date.now() });
    }
  }

  // Dashboards + their denormalized subcollections.
  for (const d of seed.dashboards) {
    const memberUids = Object.keys(d.members);
    const dashboardData = {
      name: d.name, ownerUid: d.ownerUid, createdAt: d.createdAt, updatedAt: d.updatedAt,
      members: d.members, memberUids, trackedUids: d.trackedUids,
      goals: d.goals || {}, teamGoal: d.teamGoal || null, habits: d.habits || [],
      public: { enabled: false, token: null }, // set below once series/subcollections exist
    };
    bulk.set(db.doc(`dashboards/${d.id}`), dashboardData);

    for (const uid of d.trackedUids) {
      bulk.set(db.doc(`dashboards/${d.id}/series/${uid}`), {
        uid, entries: toSeries(seed.weights[uid] || []), updatedAt: Date.now(),
      });
    }

    const habitLogsForDash = seed.habitLogs[d.id];
    if (habitLogsForDash) {
      for (const [uid, habits] of Object.entries(habitLogsForDash)) {
        bulk.set(db.doc(`dashboards/${d.id}/habitLogs/${uid}`), { uid, habits, updatedAt: Date.now() });
      }
    }

    const nsvForDash = seed.nsv[d.id];
    if (nsvForDash) {
      for (const [uid, notes] of Object.entries(nsvForDash)) {
        for (const n of notes) {
          bulk.set(db.doc(`dashboards/${d.id}/nsv/${d.id}_${uid}_${n.id}`), {
            uid, date: n.date, text: n.text, createdAt: Date.now(),
          });
        }
      }
    }
  }

  // Invites (as-authored in the seed — dashboardId 'ext-crew' is intentionally
  // not a real dashboard, matching the "pending invite to somewhere new" demo).
  for (const inv of seed.invites) {
    bulk.set(db.doc(`invites/${inv.id}`), {
      dashboardId: inv.dashboardId, dashboardName: inv.dashboardName,
      fromUid: inv.fromUid, fromName: inv.fromName, fromInitial: inv.fromInitial,
      toEmail: inv.toEmail, role: inv.role, status: inv.status, createdAt: inv.createdAt,
    });
  }

  await bulk.close();

  // Now that series/habitLogs/nsv exist, publish the one dashboard the seed
  // marks as publicly shared (mirrors firestore.js's rebuildPublic()).
  const publicDash = seed.dashboards.find((d) => d.public?.enabled && d.public?.token);
  if (publicDash) {
    const [seriesSnap, habitLogsSnap, nsvSnap] = await Promise.all([
      db.collection(`dashboards/${publicDash.id}/series`).get(),
      db.collection(`dashboards/${publicDash.id}/habitLogs`).get(),
      db.collection(`dashboards/${publicDash.id}/nsv`).get(),
    ]);
    const series = {};
    seriesSnap.forEach((s) => { series[s.id] = s.data().entries || []; });
    const habitLogs = {};
    habitLogsSnap.forEach((s) => { habitLogs[s.id] = s.data().habits || {}; });
    const nsv = {};
    nsvSnap.forEach((s) => {
      const n = s.data();
      nsv[n.uid] = nsv[n.uid] || [];
      nsv[n.uid].push({ id: s.id, date: n.date, text: n.text });
    });

    await db.doc(`dashboards/${publicDash.id}`).set({ public: { enabled: true, token: publicDash.public.token } }, { merge: true });
    await db.doc(`publicViews/${publicDash.public.token}`).set({
      dashboardId: publicDash.id, name: publicDash.name,
      members: publicDash.members, trackedUids: publicDash.trackedUids,
      goals: publicDash.goals, teamGoal: publicDash.teamGoal, habits: publicDash.habits,
      series, habitLogs, nsv, enabled: true, updatedAt: Date.now(),
    });
    console.log(`Published public link for "${publicDash.name}" → token ${publicDash.public.token}`);
  }

  console.log('\nSeed complete. Default account:');
  console.log(`  email:    ${DEFAULT_EMAIL}`);
  console.log(`  password: ${DEFAULT_PASSWORD}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
