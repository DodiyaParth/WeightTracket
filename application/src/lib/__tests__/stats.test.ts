import { describe, it, expect } from 'vitest';
import { addDays } from '../date.js';
import {
  ema, trendSeries, totalChange, weeklyRate, deltas, projection, spanDays, currentWeight, togetherChange,
} from '../stats.js';

// Build a deterministic series: `days` entries from startIso, kg = startKg + perDay*i.
function series(startIso, days, startKg, perDay) {
  return Array.from({ length: days }, (_, i) => ({ date: addDays(startIso, i), kg: +(startKg + perDay * i).toFixed(1) }));
}

describe('ema', () => {
  it('returns the same value for a constant series', () => {
    expect(ema([80, 80, 80, 80])).toEqual([80, 80, 80, 80]);
  });
  it('lags a step change (smooths)', () => {
    const out = ema([80, 90], 0.5);
    expect(out[1]).toBeCloseTo(85, 5);
  });
});

describe('basic stats', () => {
  const s = series('2026-01-01', 30, 90, -0.1); // losing 0.1 kg/day
  it('currentWeight / spanDays / totalChange', () => {
    expect(currentWeight(s)).toBeCloseTo(87.1, 1);
    expect(spanDays(s)).toBe(29);
    expect(totalChange(s)).toBeCloseTo(-2.9, 1);
  });
  it('weeklyRate is negative for a loss and near the true slope', () => {
    const wr = weeklyRate(s);
    expect(wr).toBeLessThan(0);
    expect(wr).toBeGreaterThan(-1.2);
  });
  it('trendSeries aligns to entry dates', () => {
    expect(trendSeries(s)).toHaveLength(30);
    expect(trendSeries(s)[0].date).toBe('2026-01-01');
  });
});

describe('deltas', () => {
  it('locks windows without enough history, reports the rest', () => {
    const s = series('2026-01-01', 10, 90, -0.1); // only 9 days span
    const d = deltas(s);
    expect(d.find((x) => x.window === 1).value).not.toBeNull();
    expect(d.find((x) => x.window === 7).value).not.toBeNull();
    expect(d.find((x) => x.window === 14).value).toBeNull();
    expect(d.find((x) => x.window === 28).value).toBeNull();
  });
});

describe('projection (honest)', () => {
  const goal = { targetKg: 80, targetISO: '2026-12-31' };
  it('is insufficient under 14 days', () => {
    expect(projection(series('2026-01-01', 10, 90, -0.1), goal).status).toBe('insufficient');
  });
  it('gives an ETA range when trending toward the goal', () => {
    const p = projection(series('2026-01-01', 40, 90, -0.1), goal, { todayIso: '2026-02-09' });
    expect(p.status).toBe('ok');
    expect(p.slopePerWeek).toBeLessThan(0);
    expect(p.etaISO).toBeTruthy();
    expect(p.rangeLabel).toMatch(/early|mid|late/);
  });
  it('declines to estimate when the trend is flat / moving away', () => {
    const p = projection(series('2026-01-01', 40, 90, 0), goal);
    expect(p.status).toBe('away');
    expect(p.rangeLabel).toBeNull();
  });
});

describe('togetherChange (DEV-34)', () => {
  it('sums losses across members', () => {
    const byUid = { a: series('2026-01-01', 20, 90, -0.1), b: series('2026-01-01', 20, 80, -0.05) };
    const total = togetherChange(byUid, ['a', 'b']);
    expect(total).toBeGreaterThan(0); // positive = lost, together
  });
  it('nets a member who gained against one who lost, instead of dropping them', () => {
    const gaining = series('2026-01-01', 20, 80, 0.1); // gains weight
    const losing = series('2026-01-01', 20, 90, -0.1); // loses the same amount
    const total = togetherChange({ a: gaining, b: losing }, ['a', 'b']);
    expect(total).toBeCloseTo(0, 0); // the gain offsets the loss, not dropped
  });
  it('a group that net-gains reports a negative total', () => {
    const total = togetherChange({ a: series('2026-01-01', 20, 80, 0.1) }, ['a']);
    expect(total).toBeLessThan(0);
  });
  it('ignores members with no/one-entry history', () => {
    expect(togetherChange({ a: [] }, ['a'])).toBe(0);
    expect(togetherChange({}, ['missing'])).toBe(0);
  });
});
