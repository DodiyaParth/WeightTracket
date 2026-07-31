import { describe, it, expect } from 'vitest';
import {
  bmiValue, bmiCategory, healthyRange, isSafePace, goalProgress, paceCheck, verdictVsIdeal, idealLine,
  journeyDirection, suggestTargetDate, requiredRate, paceVerdict, evaluateTargetVsHealthy,
} from '../health.js';
import { addDays } from '../date.js';

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
  it('goalProgress works for a gain goal (numerator flips with denominator)', () => {
    expect(goalProgress({ start: 55, current: 56, target: 58 })).toBeCloseTo(1 / 3, 5);
  });
  it('goalProgress gives full credit inside a maintenance band, zero outside', () => {
    expect(goalProgress({ start: 80, current: 81.5, target: 80, band: 2 })).toBe(1);
    expect(goalProgress({ start: 80, current: 83, target: 80, band: 2 })).toBe(0);
  });
  it('paceCheck: maintain / safe / unsafe / no-date', () => {
    expect(paceCheck({ current: 80, target: 80.5 }).tone).toBe('ok'); // maintenance
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
  it('verdictVsIdeal: a gain goal inverts ahead/behind (ascending ideal line)', () => {
    // gain 55→60 across the year; at ~1/4 elapsed the ideal is ≈56.2 kg.
    const ahead = verdictVsIdeal({ startKg: 55, startISO: '2026-01-01', targetKg: 60, targetISO: '2026-12-31', currentKg: 58, todayIso: '2026-04-01' });
    expect(ahead).toBe('ahead'); // above the ascending ideal → ahead
    const behind = verdictVsIdeal({ startKg: 55, startISO: '2026-01-01', targetKg: 60, targetISO: '2026-12-31', currentKg: 55.2, todayIso: '2026-04-01' });
    expect(behind).toBe('behind');
  });
});

describe('idealLine', () => {
  it('returns null without a dated target or a start', () => {
    expect(idealLine({ startKg: 90, startISO: '2026-01-01', targetKg: null, targetISO: '2026-12-31' })).toBeNull();
    expect(idealLine({ startKg: 90, startISO: '2026-01-01', targetKg: 80, targetISO: null })).toBeNull();
    expect(idealLine({ startKg: null, startISO: null, targetKg: 80, targetISO: '2026-12-31' })).toBeNull();
  });
  it('returns the start→target segment', () => {
    expect(idealLine({ startKg: 90, startISO: '2026-01-01', targetKg: 80, targetISO: '2026-12-31' }))
      .toEqual([{ date: '2026-01-01', kg: 90 }, { date: '2026-12-31', kg: 80 }]);
  });
});

describe('journeyDirection', () => {
  it('classifies loss / gain / maintain with a ±1 kg threshold', () => {
    expect(journeyDirection(90, 80)).toBe('loss');
    expect(journeyDirection(55, 58)).toBe('gain');
    expect(journeyDirection(80, 80.5)).toBe('maintain');
    expect(journeyDirection(80, 79.2)).toBe('maintain'); // within ±T
    expect(journeyDirection(null, 80)).toBe('maintain'); // missing input
  });
});

describe('suggestTargetDate', () => {
  it('loss uses 0.5 kg/wk (8 kg → 16 weeks)', () => {
    expect(suggestTargetDate('2026-01-01', 88, 80)).toBe(addDays('2026-01-01', 16 * 7));
  });
  it('gain uses the gentler 0.25 kg/wk (3 kg → 12 weeks)', () => {
    expect(suggestTargetDate('2026-01-01', 55, 58)).toBe(addDays('2026-01-01', 12 * 7));
  });
  it('maintenance uses a fixed 12-week horizon', () => {
    expect(suggestTargetDate('2026-01-01', 80, 80)).toBe(addDays('2026-01-01', 12 * 7));
  });
});

describe('requiredRate', () => {
  it('is |Δ| / weeks (8 kg over 8 weeks = 1.0)', () => {
    expect(requiredRate('2026-01-01', addDays('2026-01-01', 56), 90, 82)).toBeCloseTo(1.0, 5);
  });
  it('guards a non-positive span', () => {
    expect(requiredRate('2026-02-01', '2026-01-01', 90, 82)).toBe(0);
  });
});

describe('paceVerdict', () => {
  it('loss is safe ≤1.0, warns >1.0', () => {
    expect(paceVerdict(0.5, 'loss', 90).safe).toBe(true);
    expect(paceVerdict(1.4, 'loss', 90)).toMatchObject({ safe: false, tone: 'warn' });
  });
  it('gain uses the gentler 0.5 ceiling', () => {
    expect(paceVerdict(0.4, 'gain', 60).safe).toBe(true);
    expect(paceVerdict(0.7, 'gain', 60).safe).toBe(false);
  });
  it('warns above 1%/week of body weight even under the kg ceiling', () => {
    // 0.9 kg/wk on a 60 kg person = 1.5%/wk → warn despite < 1.0 loss ceiling
    expect(paceVerdict(0.9, 'loss', 60).safe).toBe(false);
  });
  it('flags a very-gradual pace as muted, and maintenance as steady', () => {
    expect(paceVerdict(0.2, 'loss', 90).tone).toBe('muted');
    expect(paceVerdict(0, 'maintain', 80)).toMatchObject({ safe: true, tone: 'muted' });
  });
});

describe('evaluateTargetVsHealthy', () => {
  const range: [number, number] = [59, 79];
  it('in-range is good; below-range warns', () => {
    expect(evaluateTargetVsHealthy(70, range, 'loss')).toMatchObject({ status: 'in', tone: 'ok' });
    expect(evaluateTargetVsHealthy(55, range, 'loss')).toMatchObject({ status: 'below', tone: 'warn' });
  });
  it('above-range is gentle for loss, a caution for gain', () => {
    expect(evaluateTargetVsHealthy(85, range, 'loss')).toMatchObject({ status: 'above', tone: 'muted' });
    expect(evaluateTargetVsHealthy(85, range, 'gain')).toMatchObject({ status: 'above', tone: 'warn' });
  });
  it('no range → neutral, never blocks', () => {
    expect(evaluateTargetVsHealthy(70, null, 'loss').status).toBe('in');
  });
});
