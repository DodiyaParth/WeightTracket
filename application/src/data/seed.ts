// Seed data for the in-memory / demo backend. Mirrors the designer prototype:
// Parth + Priya as the primary couple, plus a wider cast for the other
// dashboards. Weight series are generated deterministically (stable per day).
import { addDays, todayISO } from '../lib/date.js';
import { DONE, GRACE } from '../lib/habits.js';
import type {
  Dashboard, HabitLog, Invite, Member, Nsv, Profile, Role, Store, WeightEntry,
} from '../types.js';

// The demo's signed-in user.
export const DEMO_UID = 'parth';

// Profile data only — no `color`: dashboard-membership color is derived from
// join order at render time (see lib/dashboards.js memberList), never stored.
type Person = { uid: string; name: string; email: string; heightM: number };

const PEOPLE: Record<string, Person> = {
  parth: { uid: 'parth', name: 'Parth', email: 'parth@weighttracker.app', heightM: 1.78 },
  priya: { uid: 'priya', name: 'Priya', email: 'priya@weighttracker.app', heightM: 1.63 },
  arjun: { uid: 'arjun', name: 'Arjun', email: 'arjun@weighttracker.app', heightM: 1.80 },
  sara: { uid: 'sara', name: 'Sara', email: 'sara@weighttracker.app', heightM: 1.66 },
  mom: { uid: 'mom', name: 'Mom', email: 'mom@weighttracker.app', heightM: 1.60 },
  dad: { uid: 'dad', name: 'Dad', email: 'dad@weighttracker.app', heightM: 1.74 },
};

interface GenOpts { days?: number; gaps?: number[][] }

function genWeights(startKg: number, perDay: number, noise: number, { days = 120, gaps = [] }: GenOpts = {}): WeightEntry[] {
  const out: WeightEntry[] = [];
  const today = todayISO();
  for (let i = 0; i < days; i++) {
    if (gaps.some(([a, b]) => i >= a && i <= b)) continue;
    const date = addDays(today, -(days - 1 - i));
    const kg = startKg - perDay * i + Math.sin(i * 1.7) * noise + Math.cos(i * 0.6) * noise * 0.5;
    out.push({ id: date, date, kg: +kg.toFixed(1), note: '' });
  }
  return out;
}

type WeightParam = [number, number, number, GenOpts];

const WEIGHT_PARAMS: Record<string, WeightParam> = {
  parth: [88.0, 0.040, 0.5, { gaps: [[96, 99]] }],
  priya: [72.0, 0.018, 0.4, {}],
  arjun: [92.0, 0.030, 0.45, {}],
  sara: [64.0, 0.022, 0.4, {}],
  mom: [78.0, 0.020, 0.42, {}],
  dad: [85.0, 0.028, 0.45, {}],
};

// Membership facts only (uid/role/joinedAt) — name/email/heightM/color/initial
// are derived from PEOPLE (via buildSeed's `profiles`) at render time, never
// duplicated here.
function member(uid: string, role: Role, joinedDaysAgo = 30): Member {
  return { uid, role, joinedAt: Date.now() - joinedDaysAgo * 86400000 };
}

const membersMap = (...ms: Member[]): Record<string, Member> =>
  Object.fromEntries(ms.map((m): [string, Member] => [m.uid, m]));
const ago = (d: number): number => Date.now() - d * 86400000;

const dashboards: Dashboard[] = [
  {
    id: 'd1', name: 'Parth & Priya', ownerUid: 'parth', createdAt: ago(60), updatedAt: ago(0),
    members: membersMap(member('parth', 'owner', 60), member('priya', 'editor', 58)),
    trackedUids: ['parth', 'priya'],
    goals: {
      parth: { targetKg: 80.0, targetISO: '2026-09-30' },
      priya: { targetKg: 66.0, targetISO: null },
    },
    teamGoal: { label: 'Lose 15 kg together', target: 15 },
    habits: [
      { id: 'h1', label: '10k steps', emoji: '🚶' },
      { id: 'h2', label: 'No sugar', emoji: '🍬' },
      { id: 'h3', label: 'Log breakfast', emoji: '🍳' },
      { id: 'h4', label: 'Strength / walk', emoji: '💪' },
    ],
    public: { enabled: true, token: 'demo-9fa2kq7x' },
  },
  {
    id: 'd2', name: 'Marathon prep', ownerUid: 'arjun', createdAt: ago(40), updatedAt: ago(2),
    members: membersMap(member('arjun', 'owner', 40), member('parth', 'editor', 30), member('sara', 'editor', 28)),
    trackedUids: ['arjun', 'parth', 'sara'],
    goals: { parth: { targetKg: 84, targetISO: null } },
    teamGoal: { label: '12-week logging streak', target: 12 },
    habits: [{ id: 'h1', label: 'Run', emoji: '🏃' }, { id: 'h2', label: 'Stretch', emoji: '🧘' }],
    public: { enabled: false, token: null },
  },
  {
    id: 'd5', name: 'Summer cut', ownerUid: 'sara', createdAt: ago(30), updatedAt: ago(4),
    members: membersMap(member('sara', 'owner', 30), member('parth', 'editor', 20)),
    trackedUids: ['sara', 'parth'],
    goals: {}, teamGoal: { label: 'Lose 8 kg together', target: 8 },
    habits: [{ id: 'h1', label: 'No late snacks', emoji: '🌙' }],
    public: { enabled: false, token: null },
  },
  {
    id: 'd3', name: 'Mom’s journey', ownerUid: 'mom', createdAt: ago(50), updatedAt: ago(1),
    members: membersMap(member('mom', 'owner', 50), member('dad', 'editor', 48), member('parth', 'viewer', 20)),
    trackedUids: ['mom', 'dad'],
    goals: { mom: { targetKg: 70, targetISO: null } },
    teamGoal: { label: 'Reach a healthy BMI', target: 8 },
    habits: [{ id: 'h1', label: 'Morning walk', emoji: '🚶' }],
    public: { enabled: false, token: null },
  },
  {
    id: 'd4', name: 'Sister squad', ownerUid: 'sara', createdAt: ago(35), updatedAt: ago(9),
    members: membersMap(member('sara', 'owner', 35), member('priya', 'editor', 33), member('arjun', 'editor', 30), member('parth', 'viewer', 15)),
    trackedUids: ['sara', 'priya', 'arjun'],
    goals: {}, teamGoal: { label: 'Move every day', target: 30 },
    habits: [{ id: 'h1', label: 'Move 30 min', emoji: '💪' }],
    public: { enabled: false, token: null },
  },
];

// Habit completion logs for the primary dashboard (last 28 days, with a grace day).
function genHabitLog(seedStr: string, graceDay = -1): HabitLog {
  const log: HabitLog = {};
  const today = todayISO();
  let x = [...seedStr].reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let i = 0; i < 28; i++) {
    const date = addDays(today, -i);
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const r = (x % 100) / 100;
    if (i === graceDay) log[date] = GRACE;
    else if (r < 0.78) log[date] = DONE;
  }
  return log;
}

const habitLogsD1: Record<string, Record<string, HabitLog>> = {
  parth: { h1: genHabitLog('p10k'), h2: genHabitLog('pnosugar', 3), h3: genHabitLog('pbreakfast'), h4: genHabitLog('pstrength') },
  priya: { h1: genHabitLog('r10k'), h2: genHabitLog('rnosugar'), h3: genHabitLog('rbreakfast'), h4: genHabitLog('rstrength') },
};

const nsvD1: Record<string, Nsv[]> = {
  parth: [
    { id: 'n1', date: addDays(todayISO(), -4), text: 'Jeans fit looser 👖' },
    { id: 'n2', date: addDays(todayISO(), -8), text: 'Slept through the night' },
    { id: 'n3', date: addDays(todayISO(), -12), text: 'Walked up 4 floors, no breath issue' },
  ],
  priya: [{ id: 'n4', date: addDays(todayISO(), -6), text: 'More energy in the afternoon' }],
};

const invites: Invite[] = [
  {
    id: 'inv1', dashboardId: 'ext-crew', dashboardName: 'Office fitness crew',
    fromUid: 'arjun', fromName: 'Arjun Mehta', toEmail: PEOPLE.parth.email,
    role: 'editor', status: 'pending', createdAt: ago(1),
  },
];

// Builds a fresh deep-ish copy each call so the store can be reset between tests.
export function buildSeed(): Store {
  const profiles: Record<string, Profile> = {};
  const weights: Record<string, WeightEntry[]> = {};
  for (const uid of Object.keys(PEOPLE)) {
    profiles[uid] = { ...PEOPLE[uid] };
    const [s, p, n, opts] = WEIGHT_PARAMS[uid];
    weights[uid] = genWeights(s, p, n, opts);
  }
  return {
    profiles,
    weights,
    dashboards: JSON.parse(JSON.stringify(dashboards)),
    habitLogs: JSON.parse(JSON.stringify({ d1: habitLogsD1 })),
    nsv: JSON.parse(JSON.stringify({ d1: nsvD1 })),
    invites: JSON.parse(JSON.stringify(invites)),
  };
}
