import { describe, it, expect } from 'vitest';
import { iso, isoToMs, addDays, daysBetween, fuzzyMonth, parseDate, detectDateFormat } from '../date.js';

describe('date arithmetic', () => {
  it('iso() formats a Date as YYYY-MM-DD', () => {
    expect(iso(new Date(2026, 5, 30))).toBe('2026-06-30'); // month is 0-based
  });
  it('addDays / daysBetween are calendar-correct across month and DST', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-06-01', '2026-06-30')).toBe(29);
    expect(daysBetween('2026-06-30', '2026-06-01')).toBe(-29);
    // March DST boundary in many TZs — still exactly 1 day
    expect(daysBetween('2026-03-08', '2026-03-09')).toBe(1);
  });
  it('isoToMs is midnight UTC', () => {
    expect(isoToMs('2026-06-30')).toBe(Date.UTC(2026, 5, 30));
  });
  it('fuzzyMonth buckets the day into early/mid/late', () => {
    expect(fuzzyMonth('2026-09-05')).toBe('early Sep');
    expect(fuzzyMonth('2026-09-15')).toBe('mid Sep');
    expect(fuzzyMonth('2026-09-28')).toBe('late Sep');
  });
});

describe('parseDate', () => {
  it('parses each supported format', () => {
    expect(parseDate('2026-06-30', 'iso')).toBe('2026-06-30');
    expect(parseDate('30/06/2026', 'dmy')).toBe('2026-06-30');
    expect(parseDate('06/30/2026', 'mdy')).toBe('2026-06-30');
    expect(parseDate('Jun 30, 2026', 'named')).toBe('2026-06-30');
    expect(parseDate('30 June 2026', 'named')).toBe('2026-06-30');
  });
  it('rejects impossible dates', () => {
    expect(parseDate('31/13/2026', 'dmy')).toBeNull(); // month 13
    expect(parseDate('30/02/2026', 'dmy')).toBeNull(); // Feb 30
    expect(parseDate('not a date', 'iso')).toBeNull();
    expect(parseDate('', 'iso')).toBeNull();
  });
});

describe('detectDateFormat', () => {
  it('detects iso, named and disambiguates numeric d/m vs m/d', () => {
    expect(detectDateFormat(['2026-06-30', '2026-01-02'])).toBe('iso');
    expect(detectDateFormat(['Jun 30 2026', '1 Jan 2026'])).toBe('named');
    expect(detectDateFormat(['30/06/2026', '01/02/2026'])).toBe('dmy'); // 30 > 12 → day first
    expect(detectDateFormat(['06/30/2026', '01/15/2026'])).toBe('mdy'); // 30,15 in 2nd field
    expect(detectDateFormat(['01/02/2026', '03/04/2026'])).toBe('dmy'); // ambiguous → dmy
  });
});
