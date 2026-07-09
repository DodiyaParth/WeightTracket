import { describe, it, expect } from 'vitest';
import {
  bmiValue, bmiCategory, healthyRange, isSafePace, goalProgress, paceCheck, verdictVsIdeal, idealLine,
} from '../health.js';

describe('BMI', () => {
  it('computes value and category', () => {
    expect(bmiValue(80, 1.78)).toBeCloseTo(25.2, 1);
    expect(bmiCategory(bmiValue(80, 1.78))).toBe('overweight');
    expect(bmiCategory(bmiValue(70, 1.78))).toBe('healthy');
    expect(bmiCategory(17)).toBe('underweight');
    expect(bmiCategory(32)).toBe('obese');
    expect(bmiCategory(null)).toBeNull();
    expect(bmiValue(80, null)).toBeNull();
  });
  it('healthy band brackets 18.5–24.9', () => {
    expect(healthyRange(1.78)).toEqual([59, 79]);
    expect(healthyRange(null)).toBeNull();
  });
});

describe('safe pace + goals', () => {
  it('flags > 1 kg/week', () => {
    expect(isSafePace(0.8)).toBe(true);
    expect(isSafePace(-0.9)).toBe(true);
    expect(isSafePace(1.4)).toBe(false);
  });
  it('goalProgress clamps 0..1', () => {
    expect(goalProgress({ start: 90, current: 85, target: 80 })).toBeCloseTo(0.5, 5);
    expect(goalProgress({ start: 90, current: 92, target: 80 })).toBe(0);
    expect(goalProgress({ start: 90, current: 78, target: 80 })).toBe(1);
  });
  it('goalProgress handles a zero-length goal (start === target)', () => {
    expect(goalProgress({ start: 80, current: 80, target: 80 })).toBe(1);
    expect(goalProgress({ start: 80, current: 81, target: 80 })).toBe(0);
  });
  it('paceCheck: maintain / safe / unsafe / no-date', () => {
    expect(paceCheck({ current: 80, target: 82 }).tone).toBe('ok'); // already below
    const safe = paceCheck({ current: 90, target: 86, targetISO: '2026-06-30', todayIso: '2026-01-01' });
    expect(safe.safe).toBe(true);
    const unsafe = paceCheck({ current: 90, target: 80, targetISO: '2026-02-12', todayIso: '2026-01-01' });
    expect(unsafe.safe).toBe(false);
    expect(unsafe.tone).toBe('warn');
    const nodate = paceCheck({ current: 90, target: 82 });
    expect(nodate.line).toMatch(/ETA/);
  });
  it('verdictVsIdeal: behind when heavier than the ideal line', () => {
    const behind = verdictVsIdeal({ startKg: 90, startISO: '2026-01-01', targetKg: 80, targetISO: '2026-12-31', currentKg: 89, todayIso: '2026-04-01' });
    expect(behind).toBe('behind');
    const ahead = verdictVsIdeal({ startKg: 90, startISO: '2026-01-01', targetKg: 80, targetISO: '2026-12-31', currentKg: 84, todayIso: '2026-04-01' });
    expect(ahead).toBe('ahead');
  });
  it('verdictVsIdeal: onTrack for missing/degenerate inputs and small diffs', () => {
    expect(verdictVsIdeal({ startKg: 90, startISO: '2026-01-01', targetKg: 80, targetISO: null, currentKg: 89 })).toBe('onTrack');
    expect(verdictVsIdeal({ startKg: 90, startISO: '2026-12-31', targetKg: 80, targetISO: '2026-01-01', currentKg: 89 })).toBe('onTrack');
    const onLine = verdictVsIdeal({ startKg: 90, startISO: '2026-01-01', targetKg: 80, targetISO: '2026-12-31', currentKg: 87.5, todayIso: '2026-04-01' });
    expect(onLine).toBe('onTrack');
  });
});

describe('idealLine', () => {
  it('returns null without a dated target', () => {
    expect(idealLine({ currentKg: 90, targetKg: null, targetISO: '2026-12-31' })).toBeNull();
    expect(idealLine({ currentKg: 90, targetKg: 80, targetISO: null })).toBeNull();
  });
  it('returns the today→target segment', () => {
    expect(idealLine({ currentKg: 90, targetKg: 80, targetISO: '2026-12-31', todayIso: '2026-01-01' }))
      .toEqual([{ date: '2026-01-01', kg: 90 }, { date: '2026-12-31', kg: 80 }]);
  });
});
