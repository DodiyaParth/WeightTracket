import { describe, it, expect } from 'vitest';
import { fmtKg, formatChange, WEIGHT_DP } from '../format.js';

describe('fmtKg', () => {
  it('formats to 2 decimal places', () => {
    expect(fmtKg(83.2)).toBe('83.20');
    expect(fmtKg(83)).toBe('83.00');
    expect(fmtKg(83.256)).toBe('83.26');
  });
  it('returns an em-dash for null/NaN', () => {
    expect(fmtKg(null)).toBe('—');
    expect(fmtKg(undefined)).toBe('—');
    expect(fmtKg(NaN)).toBe('—');
  });
  it('respects WEIGHT_DP', () => {
    expect(WEIGHT_DP).toBe(2);
  });
});

describe('formatChange', () => {
  it('treats a negative value as a loss: good tone, down glyph, "lost" in aria', () => {
    const r = formatChange(-4.2);
    expect(r.glyph).toBe('↓');
    expect(r.tone).toBe('good');
    expect(r.text).toBe('4.20 kg');
    expect(r.aria).toBe('lost 4.20 kg');
  });
  it('treats a positive value as a gain: bad tone (default goalDirection=down), up glyph', () => {
    const r = formatChange(2.5);
    expect(r.glyph).toBe('↑');
    expect(r.tone).toBe('bad');
    expect(r.aria).toBe('gained 2.50 kg');
  });
  it('treats zero and near-zero (<0.005) as "No change", neutral', () => {
    expect(formatChange(0)).toEqual({ glyph: '—', tone: 'neutral', text: 'No change', aria: 'no change' });
    expect(formatChange(0.001)).toMatchObject({ tone: 'neutral', text: 'No change' });
    expect(formatChange(-0.001)).toMatchObject({ tone: 'neutral', text: 'No change' });
  });
  it('treats null/NaN as "No change"', () => {
    expect(formatChange(null)).toMatchObject({ text: 'No change' });
    expect(formatChange(NaN)).toMatchObject({ text: 'No change' });
  });
  it('flips meaning when goalDirection is "up" (a gain is the goal)', () => {
    const gain = formatChange(3, { goalDirection: 'up' });
    expect(gain.tone).toBe('good');
    const loss = formatChange(-3, { goalDirection: 'up' });
    expect(loss.tone).toBe('bad');
  });
  it('renders a small gain as neutral when atOrBelowGoal (maintaining)', () => {
    const r = formatChange(0.3, { atOrBelowGoal: true });
    expect(r.glyph).toBe('↑');
    expect(r.tone).toBe('neutral');
  });
  it('does not apply the atOrBelowGoal neutral override to a loss', () => {
    const r = formatChange(-0.3, { atOrBelowGoal: true });
    expect(r.tone).toBe('good');
  });
  it('uses the given unit', () => {
    expect(formatChange(-1, { unit: 'lb' }).text).toBe('1.00 lb');
  });
});
