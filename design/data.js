// Hardcoded prototype data. No backend — this only exists to populate the UI.

const DAY = 86400000;
const TODAY = new Date('2026-06-30');
export const iso = (d) => new Date(d).toISOString().slice(0, 10);
export const fmtDate = (s) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// ---- People (open-ended; couple is the v1 case) -------------------------
export const me = { id: 'parth', name: 'Parth', initial: 'Pa', email: 'parth@email.com', heightM: 1.78, color: 'var(--p1)' };
export const partner = { id: 'priya', name: 'Priya', initial: 'Pr', email: 'priya@email.com', heightM: 1.63, color: 'var(--p2)' };
export const people = {
  parth: me,
  priya: partner,
  arjun: { id: 'arjun', name: 'Arjun', initial: 'Ar', email: 'arjun@email.com', heightM: 1.80, color: 'var(--p3)' },
  sara: { id: 'sara', name: 'Sara', initial: 'Sa', email: 'sara@email.com', heightM: 1.66, color: 'var(--p4)' },
  mom: { id: 'mom', name: 'Mom', initial: 'Mo', email: 'mom@email.com', heightM: 1.60, color: 'var(--p5)' },
  dad: { id: 'dad', name: 'Dad', initial: 'Da', email: 'dad@email.com', heightM: 1.74, color: 'var(--p3)' },
};

// ---- Dated weight series (≈120 days). Deterministic noise (stable across reloads). ----
function gen(start, perDay, noise, gaps = []) {
  const out = [];
  for (let i = 0; i < 120; i++) {
    if (gaps.some(([a, b]) => i >= a && i <= b)) continue; // missing weigh-ins
    const date = iso(TODAY.getTime() - (119 - i) * DAY);
    const kg = start - perDay * i + Math.sin(i * 1.7) * noise + Math.cos(i * 0.6) * (noise * 0.5);
    out.push({ date, kg: +kg.toFixed(1) });
  }
  return out;
}
const START_W = { parth: 88.0, priya: 72.0, arjun: 92.0, sara: 64.0, mom: 78.0, dad: 85.0 };
export const series = {
  parth: gen(88.0, 0.040, 0.5, [[96, 99]]), // a 4-day gap ~3 weeks ago
  priya: gen(72.0, 0.018, 0.4),
};
// any tracked person resolves to a (deterministic) series, so the chart is N-person, not couple-only
export const seriesFor = (id) => series[id] || (series[id] = gen(START_W[id] || 80, 0.03, 0.45));
export const spark = (id) => seriesFor(id).map((p) => p.kg);

// EMA — the "trend" hero line. alpha from smoothing window.
export function ema(arr, alpha = 0.18) {
  const out = []; let prev = arr[0];
  for (const v of arr) { prev = alpha * v + (1 - alpha) * prev; out.push(+prev.toFixed(2)); }
  return out;
}
export const SMOOTHING = { Less: 0.34, Default: 0.18, More: 0.09 };

// ---- BMI helpers (§8) ----------------------------------------------------
export function bmiValue(kg, h) { return h ? +(kg / (h * h)).toFixed(1) : null; }
export function bmiCategory(bmi) {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'healthy';
  if (bmi < 30) return 'overweight';
  return 'obese';
}
export function healthyRange(h) {
  if (!h) return null;
  return [Math.round(18.5 * h * h), Math.round(24.9 * h * h)];
}

// ---- Per-person canonical state + stats ---------------------------------
// state drives EVERYTHING for that person: chart status pill, projection,
// progress verdict, motivation copy — so nothing can contradict.
export const personStats = {
  parth: {
    current: 83.3, trend: 83.6, total: -4.7, sinceDate: 'Apr 7', weekly: -0.42, safe: true,
    state: 'onTrack', projRange: 'late Sep – mid Oct', milestone5: 4.4, milestone10: 8.8, milestoneProgress: 0.62,
    deltas: [{ window: '1d', value: -0.6 }, { window: '7d', value: -0.9 }, { window: '14d', value: -1.6 }, { window: '28d', value: -2.8 }],
  },
  priya: {
    current: 69.9, trend: 70.0, total: -2.1, sinceDate: 'May 2', weekly: -1.15, safe: false,
    state: 'behind', projRange: null, milestone5: 3.6, milestone10: 7.2, milestoneProgress: 0.38,
    deltas: [{ window: '1d', value: +0.3 }, { window: '7d', value: -0.2 }, { window: '14d', value: -0.4 }, { window: '28d', value: -0.9 }],
  },
};

export const STATUS = {
  onTrack: { label: 'On track', pill: 'pill', away: false },
  ahead: { label: 'Ahead', pill: 'pill', away: false },
  behind: { label: 'Behind', pill: 'pill amber', away: true },
  plateau: { label: 'Plateau', pill: 'pill amber', away: true },
  regain: { label: 'On track', pill: 'pill', away: false },
  milestone: { label: 'Ahead', pill: 'pill', away: false },
};

// ---- Goals (per person + team) ------------------------------------------
export const goals = {
  parth: { start: 88.0, current: 83.3, target: 80.0, targetDate: 'Sep 30, 2026', targetISO: '2026-09-30' },
  priya: { start: 72.0, current: 69.9, target: 66.0, targetDate: null, targetISO: '2026-11-15' },
};
export const teamGoal = {
  label: 'Lose 15 kg together', target: 15,
  get lost() { return +(Math.abs(personStats.parth.total) + Math.abs(personStats.priya.total)).toFixed(1); }, // derived
  get pct() { return Math.min(1, this.lost / this.target); },
};

// d1's tracked people (the per-person surfaces map over this — not hardcoded pairs)
export const tracked = ['parth', 'priya'];

// Generic per-person lookups with graceful fallback, so every per-person surface
// can map over a dashboard's actual members (B10) instead of hardcoding the couple.
export function statsFor(id) {
  if (personStats[id]) return personStats[id];
  const s = seriesFor(id); const last = s[s.length - 1].kg; const first = s[0].kg;
  return { current: last, trend: +(last + 0.3).toFixed(1), total: +(last - first).toFixed(1), sinceDate: fmtDate(s[0].date), weekly: -0.35, safe: true, state: 'onTrack', projRange: 'this autumn', milestone5: +(first * 0.05).toFixed(1), milestone10: +(first * 0.1).toFixed(1), milestoneProgress: 0.5, deltas: [{ window: '1d', value: -0.2 }, { window: '7d', value: -0.6 }, { window: '14d', value: -1.0 }, { window: '28d', value: -1.8 }] };
}
export function goalFor(id) {
  if (goals[id]) return goals[id];
  const cur = statsFor(id).current;
  return { start: cur + 4, current: cur, target: +(cur - 5).toFixed(1), targetDate: null, targetISO: '2026-11-30' };
}

// ---- Motivation: per-person, self-anchored, NO social nudges (§6.4) -----
// {name} and {kg} are filled per person. No partner cadence, no claps.
export const motivationStates = {
  onTrack: { label: 'On track', emoji: '🌱', title: 'On track — keep it steady',
    body: 'A month of consistent logging. The trend is doing exactly what it should — slow and sustainable. The habit is the win.' },
  ahead: { label: 'Ahead', emoji: '🚀', title: 'Ahead of plan — ease into it',
    body: 'You’re moving a little faster than your ideal line. Great momentum — keep the pace sustainable so it sticks for good.' },
  behind: { label: 'Behind', emoji: '🧭', title: 'A slower stretch — that’s okay',
    body: 'The trend has eased off lately. Nothing’s wrong. Focus on the controllable: one consistent weigh-in and one habit today. Notice your non-scale wins too.' },
  plateau: { label: 'Plateau', emoji: '⛰️', title: 'A plateau — completely normal',
    body: 'The trend’s been flat for ~3 weeks. Plateaus happen to everyone and usually break on their own. Stay with the process — and look how far you’ve already come.' },
  regain: { label: 'Small regain', emoji: '🤍', title: 'A little bump — you’re fine',
    body: 'Today’s number ticked up. That’s water, food and timing — not fat, and not failure. One easy next step: a normal weigh-in tomorrow, same conditions.' },
  milestone: { label: 'Milestone hit', emoji: '🎉', title: 'Milestone reached — 5% down!',
    body: 'That’s −{kg} kg since you started — a threshold with real health benefits. This is your consistency paying off. Take the win.' },
};
export const MOTIV_ORDER = ['onTrack', 'ahead', 'behind', 'plateau', 'regain', 'milestone'];

// ---- Dashboards ----------------------------------------------------------
export const dashboards = [
  { id: 'd1', name: 'Parth & Priya', access: 'owner', members: [people.parth, people.priya], updatedDays: 0, updatedLabel: 'Updated today', stat: '−6.8 kg', goalLabel: 'Lose 15 kg together', goalPct: 0.45 },
  { id: 'd2', name: 'Marathon prep', access: 'editor', members: [people.parth, people.arjun, people.sara], updatedDays: 2, updatedLabel: 'Updated 2 days ago', stat: '−2.4 kg', goalLabel: '12-week logging streak', goalPct: 0.34 },
  { id: 'd5', name: 'Summer cut', access: 'editor', members: [people.parth, people.sara], updatedDays: 4, updatedLabel: 'Updated 4 days ago', stat: '−1.7 kg', goalLabel: 'Lose 8 kg together', goalPct: 0.4 },
  { id: 'd3', name: 'Mom’s journey', access: 'viewonly', members: [people.mom, people.dad], updatedDays: 1, updatedLabel: 'Updated yesterday', stat: '−3.1 kg', goalLabel: 'Reach a healthy BMI', goalPct: 0.5 },
  { id: 'd4', name: 'Sister squad', access: 'viewonly', members: [people.sara, people.priya, people.arjun, people.mom], updatedDays: 9, updatedLabel: 'Updated 9 days ago', stat: '−1.0 kg', goalLabel: 'Move every day', goalPct: 0.2 },
  { id: 'd6', name: 'Office steps', access: 'viewonly', members: [people.arjun, people.sara, people.dad], updatedDays: 12, updatedLabel: 'Updated 12 days ago', stat: '−0.6 kg', goalLabel: '8k steps daily', goalPct: 0.15 },
];
export const ACCESS = {
  owner: { label: 'Owner', editable: true },
  editor: { label: 'Editor', editable: true },
  viewonly: { label: 'View only', editable: false },
};
export const getDashboard = (id) => dashboards.find((d) => d.id === id) || dashboards[0];
export const collaborating = () => dashboards.filter((d) => ACCESS[d.access].editable);
export const viewOnly = () => dashboards.filter((d) => !ACCESS[d.access].editable);
export const recents = () => {
  const by = (a, b) => a.updatedDays - b.updatedDays;
  return [...collaborating().sort(by), ...viewOnly().sort(by)].slice(0, 5);
};
export const landingRoute = () => {
  const r = (l) => l.filter((d) => d.updatedDays <= 7).sort((a, b) => a.updatedDays - b.updatedDays)[0];
  const c = r(collaborating()); if (c) return `/dashboard/${c.id}`;
  const v = r(viewOnly()); if (v) return `/dashboard/${v.id}`;
  return '/';
};

export const pendingInvites = [
  { id: 'inv1', dashboardName: 'Office fitness crew', from: 'Arjun Mehta', fromInitial: 'Ar', members: 4, when: '1 day ago' },
];
export const notifications = [
  { id: 'n1', text: 'Priya accepted your invite to “Parth & Priya”.', sub: 'You’re now tracking toward a shared goal.', when: '2h ago', unread: true },
  { id: 'n2', text: 'Arjun invited you to “Office fitness crew”.', sub: 'Respond from your dashboards list.', when: '1d ago', unread: true },
  { id: 'n3', text: 'You reached a milestone — 5% of body weight.', sub: '−4.4 kg since you started.', when: '3d ago', unread: false },
];

// ---- Habits (inside the dashboard). grids: 0 missed · 1 done · 2 grace ----
const grid = (s) => s.split('').map((c) => +c);
export const habits = [
  { id: 'h1', label: '10k steps', emoji: '🚶', meStreak: 7, partnerStreak: 4, repaired: false, me: grid('1111011110111101111011110111'), partner: grid('1101011010110101101011010110') },
  { id: 'h2', label: 'No sugar', emoji: '🍬', meStreak: 5, partnerStreak: 9, repaired: true, me: grid('1110112011101120111011201110'), partner: grid('1111111101111111011111110111') },
  { id: 'h3', label: 'Log breakfast', emoji: '🍳', meStreak: 12, partnerStreak: 6, repaired: false, me: grid('1111111111111011111111101111'), partner: grid('1101101101101101101101101101') },
  { id: 'h4', label: 'Strength / walk', emoji: '💪', meStreak: 3, partnerStreak: 2, repaired: false, me: grid('1011010110101101011010110101'), partner: grid('0110101101011010110101101011') },
];

export const nsvSeed = [
  { date: 'Jun 26', text: 'Jeans fit looser 👖' },
  { date: 'Jun 22', text: 'Slept through the night' },
  { date: 'Jun 18', text: 'Walked up 4 floors, no breath issue' },
];

export const recentEntries = [
  { id: 'e1', date: 'Jun 30', kg: 83.3, note: 'morning' },
  { id: 'e2', date: 'Jun 29', kg: 83.6, note: '' },
  { id: 'e3', date: 'Jun 28', kg: 83.9, note: 'after travel' },
  { id: 'e4', date: 'Jun 27', kg: 84.1, note: '' },
  { id: 'e5', date: 'Jun 26', kg: 83.9, note: '' },
];
