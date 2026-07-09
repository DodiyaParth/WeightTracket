// Weight statistics: EMA trend, deltas, weekly rate, honest projection.
// All functions are pure and take entries = [{ date: 'YYYY-MM-DD', kg: number }]
// sorted ascending by date (use `sortEntries` to guarantee it).

import { daysBetween, addDays, fuzzyMonth, todayISO } from './date.js';
import type { SeriesPoint, Goal } from '../types.js';

export const SMOOTHING = { Less: 0.34, Default: 0.18, More: 0.09 };

export const sortEntries = <T extends SeriesPoint>(entries?: T[] | null): T[] =>
  [...(entries || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

// Exponential moving average — the smoothed "trend" hero line.
export function ema(values: number[], alpha: number = SMOOTHING.Default): number[] {
  const out: number[] = [];
  let prev: number | undefined;
  for (const v of values) {
    prev = prev === undefined ? v : alpha * v + (1 - alpha) * prev;
    out.push(+prev.toFixed(2));
  }
  return out;
}

// Returns [{ date, kg }] of the EMA aligned to the entry dates.
export function trendSeries(entries?: SeriesPoint[] | null, alpha: number = SMOOTHING.Default): SeriesPoint[] {
  const s = sortEntries(entries);
  const e = ema(s.map((d) => d.kg), alpha);
  return s.map((d, i) => ({ date: d.date, kg: e[i] }));
}

export const spanDays = (entries?: SeriesPoint[] | null): number => {
  const s = sortEntries(entries);
  return s.length < 2 ? 0 : daysBetween(s[0].date, s[s.length - 1].date);
};

export const currentWeight = (entries?: SeriesPoint[] | null): number | null => {
  const s = sortEntries(entries);
  return s.length ? s[s.length - 1].kg : null;
};

export function trendWeight(entries?: SeriesPoint[] | null, alpha: number = SMOOTHING.Default): number | null {
  const t = trendSeries(entries, alpha);
  return t.length ? t[t.length - 1].kg : null;
}

export function totalChange(entries?: SeriesPoint[] | null): number {
  const s = sortEntries(entries);
  if (s.length < 2) return 0;
  return +(s[s.length - 1].kg - s[0].kg).toFixed(2);
}

// Value of the trend nearest (on or before) `targetIso`.
function trendValueOn(trend: SeriesPoint[], targetIso: string): number | null {
  let best: SeriesPoint | null = null;
  for (const p of trend) {
    if (p.date <= targetIso) best = p;
    else break;
  }
  return best ? best.kg : trend.length ? trend[0].kg : null;
}

export interface StatsOpts {
  window?: number;
  alpha?: number;
  todayIso?: string;
  minDays?: number;
}

// kg/week from the trend over the last `window` days (negative = losing).
export function weeklyRate(entries?: SeriesPoint[] | null, { window = 14, alpha = SMOOTHING.Default }: StatsOpts = {}): number {
  const trend = trendSeries(entries, alpha);
  if (trend.length < 2) return 0;
  const last = trend[trend.length - 1];
  const fromIso = addDays(last.date, -window);
  const past = trendValueOn(trend, fromIso)!; // trend.length >= 2 ⇒ never null
  const days = Math.min(window, spanDays(entries)) || 1;
  return +(((last.kg - past) / days) * 7).toFixed(2);
}

export interface Delta {
  window: number;
  value: number | null;
}

// Multi-window deltas; each is null when there isn't enough history.
export function deltas(entries?: SeriesPoint[] | null, windows: number[] = [1, 7, 14, 28]): Delta[] {
  const s = sortEntries(entries);
  if (!s.length) return windows.map((w) => ({ window: w, value: null }));
  const last = s[s.length - 1];
  const have = spanDays(entries);
  return windows.map((w) => {
    if (have < w) return { window: w, value: null };
    const fromIso = addDays(last.date, -w);
    // nearest entry on/before fromIso
    let past = s[0];
    for (const e of s) { if (e.date <= fromIso) past = e; else break; }
    return { window: w, value: +(last.kg - past.kg).toFixed(2) };
  });
}

export type ProjectionStatus = 'insufficient' | 'away' | 'ok';
export interface Projection {
  status: ProjectionStatus;
  slopePerWeek: number | null;
  etaISO: string | null;
  rangeLabel: string | null;
}

// Honest forward projection.
//  status: 'insufficient' (<minDays), 'away' (trend not moving toward goal),
//          'ok' (a hedged ETA range).
export function projection(
  entries?: SeriesPoint[] | null,
  goal?: { targetKg?: number | null; target?: number | null } | null,
  { todayIso = todayISO(), minDays = 14, alpha = SMOOTHING.Default }: StatsOpts = {},
): Projection {
  const trend = trendSeries(entries, alpha);
  const have = spanDays(entries);
  if (trend.length < 2 || have < minDays) {
    return { status: 'insufficient', slopePerWeek: null, etaISO: null, rangeLabel: null };
  }
  const last = trend[trend.length - 1];
  const fromIso = addDays(last.date, -14);
  const past = trendValueOn(trend, fromIso)!; // trend.length >= 2 ⇒ never null
  const days = Math.min(14, have) || 1;
  const slopePerDay = (last.kg - past) / days; // negative = losing
  const slopePerWeek = +(slopePerDay * 7).toFixed(2);

  const target = goal?.targetKg ?? goal?.target;
  if (target == null) {
    return { status: slopePerDay < -0.001 ? 'ok' : 'away', slopePerWeek, etaISO: null, rangeLabel: null };
  }
  // Already at/below target.
  if (last.kg <= target) {
    return { status: 'ok', slopePerWeek, etaISO: todayIso, rangeLabel: 'reached' };
  }
  // Trend flat or moving away from a lower target → no honest estimate.
  if (slopePerDay >= -0.001) {
    return { status: 'away', slopePerWeek, etaISO: null, rangeLabel: null };
  }
  const etaDays = Math.round((target - last.kg) / slopePerDay);
  const etaISO = addDays(last.date, etaDays);
  // Hedge ±15% of the horizon into a month range.
  const pad = Math.max(7, Math.round(etaDays * 0.15));
  const lo = fuzzyMonth(addDays(last.date, etaDays - pad));
  const hi = fuzzyMonth(addDays(last.date, etaDays + pad));
  const rangeLabel = lo === hi ? lo : `${lo} – ${hi}`;
  return { status: 'ok', slopePerWeek, etaISO, rangeLabel };
}

// Honest "together" total across a group of people (DEV-34): sums each
// member's own trend-based change (smoothed, so one noisy weigh-in can't
// swing the group number) and nets them together — a member who gained
// correctly reduces the total instead of being silently dropped, unlike a
// naive "sum of members who lost weight only".
export function togetherChange(seriesByUid: Record<string, SeriesPoint[]>, uids?: string[] | null, alpha: number = SMOOTHING.Default): number {
  let net = 0;
  (uids || []).forEach((uid) => {
    const trend = trendSeries(seriesByUid[uid] || [], alpha);
    if (trend.length > 1) net += trend[trend.length - 1].kg - trend[0].kg;
  });
  return +(-net).toFixed(2); // positive = lost together, negative = net gained
}

export interface Summary {
  current: number | null;
  trend: number | null;
  total: number;
  weekly: number;
  spanDays: number;
  deltas: Delta[];
  projection: Projection;
}

// Convenience bundle for the dashboard stat tiles.
export function summarize(entries?: SeriesPoint[] | null, goal?: Goal | null, opts: StatsOpts = {}): Summary {
  return {
    current: currentWeight(entries),
    trend: trendWeight(entries, opts.alpha),
    total: totalChange(entries),
    weekly: weeklyRate(entries, opts),
    spanDays: spanDays(entries),
    deltas: deltas(entries),
    projection: projection(entries, goal, opts),
  };
}
