import { describe, it, expect } from 'vitest';
import { addDays } from '../date.js';
import { milestones, milestoneProgress, computeState, getMessage, STATUS, MOTIV } from '../motivation.js';

function series(startIso, days, startKg, perDay) {
  return Array.from({ length: days }, (_, i) => ({ date: addDays(startIso, i), kg: +(startKg + perDay * i).toFixed(1) }));
}

describe('milestones', () => {
  it('computes 5% / 10% thresholds and progress', () => {
    expect(milestones(90)).toEqual({ m5: 4.5, m10: 9 });
    expect(milestoneProgress(90, 85.5)).toBeCloseTo(0.5, 5);
  });
  it('guards against a zero / missing start weight', () => {
    expect(milestones(0)).toEqual({ m5: 0, m10: 0 });
    expect(milestoneProgress(0, 0)).toBe(0);
    expect(milestoneProgress(90, 95)).toBe(0); // gained → no progress, not negative
  });
});

describe('computeState', () => {
  it('defaults to onTrack with insufficient data', () => {
    expect(computeState({ entries: series('2026-01-01', 5, 90, -0.1) })).toBe('onTrack');
  });
  it('detects a plateau (flat trend)', () => {
    expect(computeState({ entries: series('2026-01-01', 30, 85, 0) })).toBe('plateau');
  });
  it('detects a daily regain spike', () => {
    const s = series('2026-01-01', 25, 90, -0.1);
    s[s.length - 1] = { date: s[s.length - 1].date, kg: s[s.length - 2].kg + 1.6 };
    expect(computeState({ entries: s })).toBe('regain');
  });
  it('detects behind vs a dated ideal line', () => {
    const s = series('2026-01-01', 30, 90, -0.02); // barely losing
    const goal = { startKg: 90, targetKg: 80, targetISO: '2026-04-11' };
    expect(computeState({ entries: s, goal })).toBe('behind');
  });
  it('flags a freshly crossed 5% milestone (on the smoothed trend)', () => {
    // Steady loss so the EMA trend crosses 5% (90 → 85.5) within the last days.
    const s = series('2026-01-01', 52, 90, -0.1);
    expect(computeState({ entries: s, goal: { startKg: 90 } })).toBe('milestone');
  });
  it('honours an explicit milestoneJustHit flag', () => {
    const s = series('2026-01-01', 30, 90, -0.1);
    expect(computeState({ entries: s, goal: { startKg: 90 }, milestoneJustHit: true })).toBe('milestone');
  });
});

describe('getMessage', () => {
  it('fills the {kg} placeholder for milestone copy', () => {
    const m = getMessage('milestone', { milestone5: 4.5 });
    expect(m.body).toContain('4.5');
    expect(m.emoji).toBe('🎉');
  });
  it('STATUS marks behind/plateau as "away"', () => {
    expect(STATUS.behind.away).toBe(true);
    expect(STATUS.onTrack.away).toBe(false);
  });
  it('falls back to onTrack copy for an unknown state and blanks {kg} when absent', () => {
    const m = getMessage('totally-unknown');
    expect(m.title).toBe(MOTIV.onTrack.title);
    expect(m.body).not.toContain('{kg}');
  });
});
