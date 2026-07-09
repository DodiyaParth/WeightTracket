import { describe, it, expect } from 'vitest';
import { iso, isoToMs, fmtLong, fuzzyMonth, parseDate, detectDateFormat } from '../date.js';

describe('date — numeric-timestamp and partial inputs', () => {
  it('iso() accepts a timestamp as well as a Date', () => {
    const ms = Date.UTC(2026, 5, 30, 12);
    expect(iso(ms)).toBe(iso(new Date(ms)));
  });
  it('isoToMs defaults missing month/day to 1', () => {
    expect(isoToMs('2026')).toBe(Date.UTC(2026, 0, 1));
  });
  it('fmtLong and fuzzyMonth accept a raw timestamp', () => {
    const ms = isoToMs('2026-09-15');
    expect(fmtLong(ms)).toMatch(/2026/);
    expect(fuzzyMonth(ms)).toBe('mid Sep');
  });
});

describe('parseDate — rejection branches', () => {
  it('returns null for nullish input', () => {
    expect(parseDate(null, 'iso')).toBeNull();
  });
  it('returns null for an unmatched named date', () => {
    expect(parseDate('sometime last year', 'named')).toBeNull();
  });
  it('returns null for an unknown month name', () => {
    expect(parseDate('Zzz 30, 2026', 'named')).toBeNull();
  });
  it('returns null when there are fewer than three parts', () => {
    expect(parseDate('2026-06', 'iso')).toBeNull();
  });
  it('returns null for an unknown format key', () => {
    expect(parseDate('2026-06-30', 'weird')).toBeNull();
  });
});

describe('detectDateFormat — sparse samples', () => {
  it('ignores nullish/blank samples and defaults to iso when empty', () => {
    expect(detectDateFormat([null, ''])).toBe('iso');
  });
  it('skips numeric samples that do not split into three parts', () => {
    expect(detectDateFormat(['13/06/2026', '12'])).toBe('dmy');
  });
});
