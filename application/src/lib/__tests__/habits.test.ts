import { describe, it, expect } from 'vitest';
import { currentStreak, wasRepaired, applyAutoGrace, DONE, GRACE } from '../habits.js';

const log = (...dates) => Object.fromEntries(dates.map((d) => [d, DONE]));

describe('currentStreak', () => {
  it('counts consecutive done days back from today', () => {
    expect(currentStreak(log('2026-06-28', '2026-06-29', '2026-06-30'), '2026-06-30')).toBe(3);
  });
  it('a missing day breaks the streak', () => {
    expect(currentStreak(log('2026-06-26', '2026-06-29', '2026-06-30'), '2026-06-30')).toBe(2);
  });
  it("today being un-logged doesn't reset yesterday's streak", () => {
    expect(currentStreak(log('2026-06-28', '2026-06-29'), '2026-06-30')).toBe(2);
  });
  it('grace days continue the streak (forgiving)', () => {
    const l = { '2026-06-28': DONE, '2026-06-29': GRACE, '2026-06-30': DONE };
    expect(currentStreak(l, '2026-06-30')).toBe(3);
    expect(wasRepaired(l, '2026-06-30')).toBe(true);
  });
});

describe('applyAutoGrace (DEV-20)', () => {
  it('forgives a single missed day between two done days', () => {
    const l = { '2026-06-28': DONE };
    const out = applyAutoGrace(l, '2026-06-30'); // 29th missed, 28th done
    expect(out['2026-06-29']).toBe(GRACE);
    expect(currentStreak({ ...out, '2026-06-30': DONE }, '2026-06-30')).toBe(3);
  });
  it('does not forgive two or more missed days in a row', () => {
    const l = { '2026-06-25': DONE };
    const out = applyAutoGrace(l, '2026-06-30'); // 26th–29th all missed
    expect(out['2026-06-29']).toBeUndefined();
  });
  it('does nothing if the previous day was already logged', () => {
    const l = { '2026-06-29': DONE };
    const out = applyAutoGrace(l, '2026-06-30');
    expect(out).toEqual(l);
  });
  it('does nothing at the very start of a streak (no prior day)', () => {
    const out = applyAutoGrace({}, '2026-06-30');
    expect(out).toEqual({});
  });
});
