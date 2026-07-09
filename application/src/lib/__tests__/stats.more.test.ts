import { describe, it, expect } from 'vitest';
import { addDays } from '../date.js';
import {
  sortEntries, spanDays, currentWeight, trendWeight, totalChange, weeklyRate, deltas, projection, togetherChange,
} from '../stats.js';

const series = (startIso, days, startKg, perDay) =>
  Array.from({ length: days }, (_, i) => ({ date: addDays(startIso, i), kg: +(startKg + perDay * i).toFixed(1) }));

describe('stats — empty / degenerate inputs', () => {
  it('sortEntries tolerates undefined and keeps equal dates stable', () => {
    expect(sortEntries(undefined)).toEqual([]);
    const dup = [{ date: '2026-01-01', kg: 80 }, { date: '2026-01-01', kg: 81 }];
    expect(sortEntries(dup).map((e) => e.kg)).toEqual([80, 81]);
  });
  it('single/empty series collapse to zero-ish results', () => {
    expect(spanDays([])).toBe(0);
    expect(spanDays([{ date: '2026-01-01', kg: 80 }])).toBe(0);
    expect(currentWeight([])).toBeNull();
    expect(trendWeight([])).toBeNull();
    expect(totalChange([{ date: '2026-01-01', kg: 80 }])).toBe(0);
    expect(weeklyRate([])).toBe(0);
    expect(deltas([]).every((d) => d.value === null)).toBe(true);
  });
  it('weeklyRate handles a window wider than the span (no past point on/before fromIso)', () => {
    // Two entries on the same date → span 0 → the `|| 1` day guard, and the
    // trend has no point on/before fromIso → falls back to trend[0].
    const rate = weeklyRate([{ date: '2026-01-01', kg: 80 }, { date: '2026-01-01', kg: 81 }]);
    expect(Number.isFinite(rate)).toBe(true);
  });
});

describe('projection — no-target and reached goals', () => {
  it('reports ok/away for a goal with no target', () => {
    const down = projection(series('2026-01-01', 40, 90, -0.1), {}, { todayIso: '2026-02-09' });
    expect(down.status).toBe('ok');
    expect(down.etaISO).toBeNull();
    const flat = projection(series('2026-01-01', 40, 85, 0), {}, { todayIso: '2026-02-09' });
    expect(flat.status).toBe('away');
  });
  it('reports "reached" when the trend is already at/below target', () => {
    const p = projection(series('2026-01-01', 40, 82, -0.1), { targetKg: 85 }, { todayIso: '2026-02-09' });
    expect(p.status).toBe('ok');
    expect(p.rangeLabel).toBe('reached');
  });
});

describe('togetherChange — missing uids list', () => {
  it('returns 0 when uids is undefined', () => {
    expect(togetherChange({}, undefined)).toBe(0);
  });
});
