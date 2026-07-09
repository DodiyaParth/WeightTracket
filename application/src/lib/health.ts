// BMI, healthy-weight band, and goal pace / safety logic (REQUIREMENTS §6.3, §6.6, §8).
import { daysBetween, todayISO } from './date.js';
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

// ---- Goal progress + pace check -----------------------------------------
export function goalProgress({ start, current, target }: { start: number; current: number; target: number }): number {
  const denom = start - target;
  if (!denom) return current <= target ? 1 : 0;
  return Math.max(0, Math.min(1, (start - current) / denom));
}

export type PaceTone = 'ok' | 'warn' | 'muted';
export interface PaceCheck {
  kgPerWeek: number;
  safe: boolean;
  tone: PaceTone;
  line: string;
}

// For the goal editor: implied pace and a human line.
export function paceCheck({ current, target, targetISO, todayIso = todayISO() }: {
  current: number;
  target?: number | null;
  targetISO?: string | null;
  todayIso?: string;
}): PaceCheck {
  const lose = Math.max(0, current - Number(target || 0));
  if (lose <= 0) return { kgPerWeek: 0, safe: true, tone: 'ok', line: 'Maintain — already at or below target.' };
  if (targetISO) {
    const weeks = Math.max(0.5, daysBetween(todayIso, targetISO) / 7);
    const pace = lose / weeks;
    if (pace > SAFE_MAX) {
      return { kgPerWeek: +pace.toFixed(2), safe: false, tone: 'warn', line: `This needs ~${pace.toFixed(1)} kg/wk — faster than the safe 0.5–1.0 range.` };
    }
    return { kgPerWeek: +pace.toFixed(2), safe: true, tone: 'ok', line: `~${pace.toFixed(2)} kg/wk — within the safe range.` };
  }
  const weeks = Math.round(lose / 0.75);
  return { kgPerWeek: 0.75, safe: true, tone: 'muted', line: `No date — safe-pace ETA ≈ ${weeks} weeks at 0.5–1.0 kg/wk.` };
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
  const diff = currentKg - idealNow; // >0 means heavier than ideal (behind, for a loss goal)
  if (Math.abs(diff) < 0.4) return 'onTrack';
  return diff < 0 ? 'ahead' : 'behind';
}

// The point on the ideal line for charting (today → target by targetISO).
export function idealLine({ currentKg, targetKg, targetISO, todayIso = todayISO() }: {
  currentKg: number;
  targetKg?: number | null;
  targetISO?: string | null;
  todayIso?: string;
}): SeriesPoint[] | null {
  if (targetKg == null || !targetISO) return null;
  return [{ date: todayIso, kg: currentKg }, { date: targetISO, kg: targetKg }];
}
