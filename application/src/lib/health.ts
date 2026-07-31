// BMI, healthy-weight band, and goal pace / safety logic (REQUIREMENTS §6.3, §6.6, §8).
import { addDays, daysBetween, todayISO } from './date.js';
import type { SeriesPoint } from '../types.js';

// ---- BMI ----------------------------------------------------------------
export function bmiValue(kg: number | null | undefined, heightM: number | null | undefined): number | null {
  if (!heightM || !kg) return null;
  return +(kg / (heightM * heightM)).toFixed(1);
}
export function bmiCategory(bmi: number | null | undefined): string | null {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'healthy';
  if (bmi < 30) return 'overweight';
  return 'obese';
}
export function healthyRange(heightM: number | null | undefined): [number, number] | null {
  if (!heightM) return null;
  return [Math.round(18.5 * heightM * heightM), Math.round(24.9 * heightM * heightM)];
}

// ---- Safe pace (CDC/NHS: 0.5–1.0 kg/week) -------------------------------
export const SAFE_MIN = 0.5;
export const SAFE_MAX = 1.0;
export const isSafePace = (kgPerWeek: number): boolean => Math.abs(kgPerWeek) <= SAFE_MAX + 1e-9;

// ---- Journey direction + pace tuning (PRD §4.2, §5, §12) ----------------
// Suggested/ceiling weekly rates differ by direction: loss is the classic
// 0.5 suggest / 1.0 ceiling; gain uses a gentler lean-gain 0.25 / 0.5 to
// favor lean mass. Both also warn above 1%/week of current body weight.
export const LOSS_SUGGEST = 0.5;
export const LOSS_CEILING = 1.0;
export const GAIN_SUGGEST = 0.25;
export const GAIN_CEILING = 0.5;
export const BODYWEIGHT_PCT_CEILING = 0.01; // 1%/week
// |target − start| ≤ this ⇒ maintenance (no target rate; a ± band instead).
export const MAINTAIN_THRESHOLD = 1.0;
export const MAINTAIN_HORIZON_WEEKS = 12;

export type Direction = 'loss' | 'gain' | 'maintain';

// Auto-detected from start vs target, never asked (PRD §5). `maintain` when the
// two are within ±T (default 1 kg).
export function journeyDirection(startKg: number | null | undefined, targetKg: number | null | undefined, T: number = MAINTAIN_THRESHOLD): Direction {
  if (startKg == null || targetKg == null) return 'maintain';
  const delta = targetKg - startKg;
  if (delta <= -T) return 'loss';
  if (delta >= T) return 'gain';
  return 'maintain';
}

// ---- Goal progress + pace check -----------------------------------------
// Works for loss (denom > 0) and gain (denom < 0) alike — the sign of the
// numerator flips with the denominator, so the fraction stays correct either
// way. For a maintenance goal (start === target) an optional `band` gives full
// credit while within ±band of target; without a band the legacy at-or-below
// rule is preserved so existing callers are unaffected.
export function goalProgress({ start, current, target, band }: { start: number; current: number; target: number; band?: number }): number {
  const denom = start - target;
  if (!denom) {
    if (band != null) return Math.abs(current - target) <= band ? 1 : 0;
    return current <= target ? 1 : 0;
  }
  return Math.max(0, Math.min(1, (start - current) / denom));
}

export type PaceTone = 'ok' | 'warn' | 'muted';
export interface PaceCheck {
  kgPerWeek: number;
  safe: boolean;
  tone: PaceTone;
  line: string;
}

export interface PaceVerdict {
  tone: PaceTone;
  safe: boolean;
  label: string;
}

// Classify a weekly rate for a direction (PRD §4.2). Warns above the
// direction's ceiling OR above 1%/week of body weight; flags a very-gradual
// pace (under the suggested rate) as a calm 'muted', everything safe in
// between as 'ok'. Maintenance has no rate — always steady.
export function paceVerdict(rate: number, direction: Direction, bodyKg?: number | null): PaceVerdict {
  if (direction === 'maintain') return { tone: 'muted', safe: true, label: 'hold steady' };
  const ceiling = direction === 'gain' ? GAIN_CEILING : LOSS_CEILING;
  const pctCeiling = bodyKg ? bodyKg * BODYWEIGHT_PCT_CEILING : Infinity;
  if (rate > ceiling + 1e-9 || rate > pctCeiling + 1e-9) {
    return { tone: 'warn', safe: false, label: "faster than we'd suggest" };
  }
  const suggest = direction === 'gain' ? GAIN_SUGGEST : LOSS_SUGGEST;
  if (rate > 0 && rate < suggest - 1e-9) return { tone: 'muted', safe: true, label: 'nice and gradual' };
  return { tone: 'ok', safe: true, label: 'a safe, steady pace' };
}

// For the goal editor: implied pace from *today* to the target date and a
// human, direction-aware line. (The wizard uses requiredRate over start→end
// instead — that's the plan average; this is "from where you are now".)
export function paceCheck({ current, target, targetISO, todayIso = todayISO() }: {
  current: number;
  target?: number | null;
  targetISO?: string | null;
  todayIso?: string;
}): PaceCheck {
  const t = Number(target || 0);
  const direction = journeyDirection(current, t);
  if (direction === 'maintain') return { kgPerWeek: 0, safe: true, tone: 'ok', line: `Maintain around ${t} kg.` };
  const distance = Math.abs(current - t);
  const verb = direction === 'gain' ? 'gain' : 'lose';
  if (targetISO) {
    const weeks = Math.max(0.5, daysBetween(todayIso, targetISO) / 7);
    const pace = +(distance / weeks).toFixed(2);
    const v = paceVerdict(pace, direction, current);
    return { kgPerWeek: pace, safe: v.safe, tone: v.tone, line: `~${pace.toFixed(2)} kg/wk to ${verb} — ${v.label}.` };
  }
  const suggest = direction === 'gain' ? GAIN_SUGGEST : LOSS_SUGGEST;
  const weeks = Math.round(distance / suggest);
  return { kgPerWeek: suggest, safe: true, tone: 'muted', line: `No date — safe-pace ETA ≈ ${weeks} weeks.` };
}

export type Verdict = 'ahead' | 'onTrack' | 'behind';

// Are we ahead / on track / behind the ideal descent line for a dated goal?
export function verdictVsIdeal({ startKg, startISO, targetKg, targetISO, currentKg, todayIso = todayISO() }: {
  startKg?: number | null;
  startISO: string;
  targetKg?: number | null;
  targetISO?: string | null;
  currentKg: number;
  todayIso?: string;
}): Verdict {
  if (!targetISO || startKg == null || targetKg == null) return 'onTrack';
  const totalDays = daysBetween(startISO, targetISO);
  if (totalDays <= 0) return 'onTrack';
  const elapsed = Math.max(0, Math.min(totalDays, daysBetween(startISO, todayIso)));
  const idealNow = startKg + (targetKg - startKg) * (elapsed / totalDays);
  const diff = currentKg - idealNow;
  if (Math.abs(diff) < 0.4) return 'onTrack';
  // Direction-aware: for a loss goal the ideal line descends, so being *below*
  // it (diff < 0) is ahead; for a gain goal it ascends, so being *above* it
  // (diff > 0) is ahead. Without this flip a gaining user on track to gain
  // would read as "behind" (DEV-32 / PRD §5).
  const direction = journeyDirection(startKg, targetKg);
  if (direction === 'gain') return diff > 0 ? 'ahead' : 'behind';
  return diff < 0 ? 'ahead' : 'behind';
}

// The ideal-progress segment for charting — anchored at the journey's real
// start (startISO, startKg), not today, so the line shows the whole planned
// path (up, down, or flat) rather than only the remaining stretch (PRD §5, §9).
export function idealLine({ startKg, startISO, targetKg, targetISO }: {
  startKg?: number | null;
  startISO?: string | null;
  targetKg?: number | null;
  targetISO?: string | null;
}): SeriesPoint[] | null {
  if (targetKg == null || !targetISO || startKg == null || !startISO) return null;
  return [{ date: startISO, kg: startKg }, { date: targetISO, kg: targetKg }];
}

// ---- Wizard helpers: suggested date, required rate, healthy-target eval ---

// Pre-filled target date at a safe pace (PRD §4.2): loss 0.5 / gain 0.25 kg per
// week; maintenance has no rate, so it defaults to a fixed hold-horizon.
export function suggestTargetDate(startISO: string, startKg: number, targetKg: number): string {
  const direction = journeyDirection(startKg, targetKg);
  if (direction === 'maintain') return addDays(startISO, MAINTAIN_HORIZON_WEEKS * 7);
  const rate = direction === 'gain' ? GAIN_SUGGEST : LOSS_SUGGEST;
  const weeks = Math.max(1, Math.ceil(Math.abs(targetKg - startKg) / rate));
  return addDays(startISO, weeks * 7);
}

// The plan-average weekly rate implied by hitting `targetKg` by `endISO` from
// `(startISO, startKg)`. Always ≥ 0 (magnitude); direction is a separate axis.
export function requiredRate(startISO: string, endISO: string, startKg: number, targetKg: number): number {
  const weeks = daysBetween(startISO, endISO) / 7;
  if (weeks <= 0) return 0;
  return +(Math.abs(targetKg - startKg) / weeks).toFixed(2);
}

export type HealthyStatus = 'in' | 'below' | 'above';
export interface HealthyEval {
  status: HealthyStatus;
  tone: PaceTone;
  line: string;
}

// Evaluate a target against the healthy band (PRD §4.1). Never blocks — tone
// only. Below the band is always a caution; above it is a gentle "solid first
// target" for a loss goal but a caution for a gain goal that overshoots.
export function evaluateTargetVsHealthy(targetKg: number | null | undefined, range: [number, number] | null | undefined, direction: Direction): HealthyEval {
  if (range == null || targetKg == null) return { status: 'in', tone: 'muted', line: '' };
  const [lo, hi] = range;
  if (targetKg < lo) return { status: 'below', tone: 'warn', line: 'Below the healthy range — that’s underweight territory.' };
  if (targetKg > hi) {
    return direction === 'gain'
      ? { status: 'above', tone: 'warn', line: 'Above the healthy range.' }
      : { status: 'above', tone: 'muted', line: 'Still above the healthy range — a solid first target.' };
  }
  return { status: 'in', tone: 'ok', line: 'Within your healthy range 👍' };
}
