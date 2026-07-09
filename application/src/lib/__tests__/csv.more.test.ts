import { describe, it, expect } from 'vitest';
import { parseCsv, detectColumns, parseWeightValue } from '../csv.js';

describe('parseCsv — empty input', () => {
  it('returns an empty shape for blank text', () => {
    expect(parseCsv('   ')).toEqual({ header: [], rows: [], hasHeader: false });
  });
});

describe('detectColumns — content sniffing fallbacks', () => {
  it('sniffs a named-date column (letters, no separators)', () => {
    const { header, rows } = parseCsv('a,b\nJun 30 2026,83.3\nJul 01 2026,83.1');
    expect(detectColumns(header, rows).dateIdx).toBe(0);
  });
  it('falls back to index 0/1 when nothing looks like a date or weight', () => {
    const { header, rows } = parseCsv('x,y\n5,10\n6,11');
    expect(detectColumns(header, rows)).toEqual({ dateIdx: 0, weightIdx: 1 });
  });
  it('chooses weight column 0 when the date keyword is column 1', () => {
    const { header, rows } = parseCsv('foo,date\nabc,2026-06-30');
    const cols = detectColumns(header, rows);
    expect(cols.dateIdx).toBe(1);
    expect(cols.weightIdx).toBe(0);
  });
  it('never collapses both columns onto the same single-column header', () => {
    const { header, rows } = parseCsv('date\n2026-06-30');
    expect(detectColumns(header, rows)).toEqual({ dateIdx: 0, weightIdx: 0 });
  });
});

describe('parseWeightValue — separator edge cases', () => {
  it('rejects doubly-ambiguous multi-separator input', () => {
    expect(parseWeightValue('1.2.3,4,5')).toBeNaN();
  });
  it('treats repeated dots (no comma) as thousands grouping', () => {
    expect(parseWeightValue('1.020.500')).toBe(1020500);
  });
});
