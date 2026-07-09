import { describe, it, expect } from 'vitest';
import { PERSON_COLORS, colorForIndex, initials } from '../colors.js';

describe('colorForIndex', () => {
  it('maps the first indices to distinct person colors', () => {
    expect(colorForIndex(0)).toBe('var(--p1)');
    expect(colorForIndex(1)).toBe('var(--p2)');
    expect(colorForIndex(4)).toBe('var(--p5)');
  });

  it('wraps around after the last color', () => {
    expect(colorForIndex(PERSON_COLORS.length)).toBe('var(--p1)');
    expect(colorForIndex(PERSON_COLORS.length + 1)).toBe('var(--p2)');
  });
});

describe('initials', () => {
  it('takes the first letter of the first two name parts', () => {
    expect(initials('Parth Dodiya')).toBe('PD');
  });

  it('uses the first two letters of a single-word name', () => {
    expect(initials('Sam')).toBe('SA');
  });

  it('falls back to the email when there is no name', () => {
    expect(initials('', 'zoe@example.com')).toBe('ZO');
    expect(initials(undefined, 'zoe@example.com')).toBe('ZO');
  });

  it('returns a placeholder when nothing is available', () => {
    expect(initials('')).toBe('?');
    expect(initials(null, null)).toBe('?');
  });
});
