import { describe, it, expect } from 'vitest';
import { parseCsv, detectColumns, suggestDateFormat, buildImport, parseWeightValue } from '../csv.js';

describe('parseCsv', () => {
  it('detects a header row', () => {
    const { header, rows, hasHeader } = parseCsv('date,weight_kg\n2026-06-30,83.3\n2026-06-29,83.6');
    expect(hasHeader).toBe(true);
    expect(header).toEqual(['date', 'weight_kg']);
    expect(rows).toHaveLength(2);
  });
  it('handles a headerless file', () => {
    const { hasHeader, header, rows } = parseCsv('2026-06-30,83.3\n2026-06-29,83.6');
    expect(hasHeader).toBe(false);
    expect(header).toEqual(['Column 1', 'Column 2']);
    expect(rows).toHaveLength(2);
  });
});

describe('detectColumns + format', () => {
  it('finds columns by header keyword', () => {
    const { header, rows } = parseCsv('when,note,kg\n2026-06-30,morning,83.3');
    expect(detectColumns(header, rows)).toEqual({ dateIdx: 0, weightIdx: 2 });
  });
  it('finds columns by content sniffing when headers are vague', () => {
    const { header, rows } = parseCsv('a,b\n2026-06-30,83.3\n2026-06-29,83.6');
    const cols = detectColumns(header, rows);
    expect(cols.dateIdx).toBe(0);
    expect(cols.weightIdx).toBe(1);
  });
  it('suggests the date format from the data', () => {
    const { rows } = parseCsv('date,kg\n30/06/2026,83.3\n29/06/2026,83.6');
    expect(suggestDateFormat(rows, 0)).toBe('dmy');
  });
});

describe('buildImport', () => {
  it('separates good entries from flagged rows', () => {
    const { rows } = parseCsv(
      'date,kg\n2026-06-30,83.3\n2026-06-29,83.6\n31/13/2026,84.0\n2026-06-28,9'
    );
    const res = buildImport(rows, { dateIdx: 0, weightIdx: 1, fmt: 'iso' });
    expect(res.entries).toHaveLength(2); // two valid
    expect(res.entries[0]).toEqual({ date: '2026-06-30', kg: 83.3, note: '' });
    const reasons = res.bad.map((b) => b.reason);
    expect(reasons).toContain('can’t parse date'); // 31/13 under iso
    expect(reasons).toContain('invalid weight'); // 9 kg
    expect(res.total).toBe(4);
    expect(res.ready).toBe(2);
  });

  it('merges a date repeated in the file — the LAST value wins, not flagged as bad (DEV-22)', () => {
    const { rows } = parseCsv('date,kg\n2026-06-30,83.3\n2026-06-29,83.6\n2026-06-30,82.0');
    const res = buildImport(rows, { dateIdx: 0, weightIdx: 1, fmt: 'iso' });
    expect(res.entries).toHaveLength(2);
    expect(res.entries.find((e) => e.date === '2026-06-30').kg).toBe(82.0); // last one wins
    expect(res.bad.map((b) => b.reason)).not.toContain('duplicate date');
    expect(res.duplicates).toBe(1);
    expect(res.total).toBe(3);
    expect(res.ready).toBe(2);
  });

  it('parses locale-comma decimals in the weight column (DEV-22)', () => {
    const { rows } = parseCsv('date,kg\n2026-06-30,"82,5"');
    const res = buildImport(rows, { dateIdx: 0, weightIdx: 1, fmt: 'iso' });
    expect(res.entries).toEqual([{ date: '2026-06-30', kg: 82.5, note: '' }]);
  });
});

describe('parseWeightValue', () => {
  it('parses a plain decimal', () => { expect(parseWeightValue('83.2')).toBe(83.2); });
  it('parses a comma-decimal (European convention)', () => { expect(parseWeightValue('82,5')).toBe(82.5); });
  it('parses dot-thousands + comma-decimal', () => { expect(parseWeightValue('1.020,5')).toBe(1020.5); });
  it('parses comma-thousands + dot-decimal', () => { expect(parseWeightValue('1,020.5')).toBe(1020.5); });
  it('treats a lone repeated comma as thousands grouping (no decimal)', () => { expect(parseWeightValue('1,234,567')).toBe(1234567); });
  it('rejects genuinely ambiguous multi-separator input', () => { expect(parseWeightValue('1.234,567.89')).toBeNaN(); });
  it('rejects non-numeric input', () => { expect(parseWeightValue('abc')).toBeNaN(); });
});
