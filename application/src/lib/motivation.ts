// Per-person motivation engine (REQUIREMENTS §6.4). Self-anchored only — no
// partner cadence, no social nudges. State is derived from a person's own trend.
import { sortEntries, trendSeries, spanDays } from './stats.js';
import { verdictVsIdeal } from './health.js';
import { addDays } from './date.js';
import type { SeriesPoint, Goal } from '../types.js';

export type MotivState = 'onTrack' | 'ahead' | 'behind' | 'plateau' | 'regain' | 'milestone';

export interface StatusInfo {
  label: string;
  away: boolean;
  amber: boolean;
}
export interface MotivInfo {
  label: string;
  emoji: string;
  title: string;
  body: string;
}

export const STATUS: Record<string, StatusInfo> = {
  onTrack: { label: 'On track', away: false, amber: false },
  ahead: { label: 'Ahead', away: false, amber: false },
  behind: { label: 'Behind', away: true, amber: true },
  plateau: { label: 'Plateau', away: true, amber: true },
  regain: { label: 'On track', away: false, amber: false },
  milestone: { label: 'Ahead', away: false, amber: false },
};

export const MOTIV_ORDER: MotivState[] = ['onTrack', 'ahead', 'behind', 'plateau', 'regain', 'milestone'];

export const MOTIV: Record<string, MotivInfo> = {
  onTrack: { label: 'On track', emoji: '🌱', title: 'On track — keep it steady',
    body: 'Consistent logging is paying off. The trend is doing exactly what it should — slow and sustainable. The habit is the win.' },
  ahead: { label: 'Ahead', emoji: '🚀', title: 'Ahead of plan — ease into it',
    body: 'You’re moving a little faster than your ideal line. Great momentum — keep the pace sustainable so it sticks for good.' },
  behind: { label: 'Behind', emoji: '🧭', title: 'A slower stretch — that’s okay',
    body: 'The trend has eased off lately. Nothing’s wrong. Focus on the controllable: one consistent weigh-in and one habit today. Notice your non-scale wins too.' },
  plateau: { label: 'Plateau', emoji: '⛰️', title: 'A plateau — completely normal',
    body: 'The trend’s been flat for a few weeks. Plateaus happen to everyone and usually break on their own. Stay with the process — and look how far you’ve already come.' },
  regain: { label: 'Small regain', emoji: '🤍', title: 'A little bump — you’re fine',
    body: 'Today’s number ticked up. That’s water, food and timing — not fat, and not failure. One easy next step: a normal weigh-in tomorrow, same conditions.' },
  milestone: { label: 'Milestone hit', emoji: '🎉', title: 'Milestone reached — 5% down!',
    body: 'That’s {kg} kg lost since you started — a threshold with real health benefits. This is your consistency paying off. Take the win.' },
};

// 5% / 10% of starting body weight (real health-benefit thresholds).
export function milestones(startKg?: number): { m5: number; m10: number } {
  if (!startKg) return { m5: 0, m10: 0 };
  return { m5: +(startKg * 0.05).toFixed(1), m10: +(startKg * 0.1).toFixed(1) };
}

export function milestoneProgress(startKg: number, currentKg: number): number {
  const lost = Math.max(0, startKg - currentKg);
  const tenPct = startKg * 0.1;
  return tenPct ? Math.max(0, Math.min(1, lost / tenPct)) : 0;
}

// Derive a person's canonical state from their own data + goal.
//  - <14 days → onTrack (gentle default, don't over-interpret noise)
//  - last raw spike above recent trend → regain
//  - flat trend ~21d → plateau
//  - just crossed the 5% milestone → milestone
//  - otherwise pace vs ideal: ahead / behind / onTrack
export function computeState({ entries, goal, alpha, milestoneJustHit = false }: {
  entries?: SeriesPoint[];
  goal?: Goal | null;
  alpha?: number;
  milestoneJustHit?: boolean;
} = {}): MotivState {
  const s = sortEntries(entries);
  if (s.length < 2 || spanDays(entries) < 14) return 'onTrack';

  const trend = trendSeries(entries, alpha);
  const last = trend[trend.length - 1];
  const lastRaw = s[s.length - 1].kg;

  const startKg = goal?.startKg ?? s[0].kg;
  const { m5 } = milestones(startKg);
  const lost = startKg - last.kg;
  // crossed the 5% line within the last ~10 days?
  if (milestoneJustHit || (m5 > 0 && lost >= m5 && (startKg - trend[Math.max(0, trend.length - 10)].kg) < m5)) {
    return 'milestone';
  }

  // daily spike: today's raw notably above the smoothed trend
  if (lastRaw - last.kg > 0.7) return 'regain';

  // plateau: trend essentially flat over ~21 days
  const backIso = addDays(last.date, -21);
  let past = trend[0];
  for (const p of trend) { if (p.date <= backIso) past = p; else break; }
  if (Math.abs(last.kg - past.kg) < 0.3) return 'plateau';

  if (goal?.targetISO) {
    const v = verdictVsIdeal({
      startKg, startISO: s[0].date, targetKg: goal.targetKg, targetISO: goal.targetISO,
      currentKg: last.kg,
    });
    return v; // 'ahead' | 'onTrack' | 'behind'
  }
  return 'onTrack';
}

export function getMessage(state: string, { milestone5 }: { milestone5?: number | string } = {}): MotivInfo {
  const m = MOTIV[state] || MOTIV.onTrack;
  return { ...m, body: m.body.replace('{kg}', String(milestone5 ?? '')) };
}
