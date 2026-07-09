import { describe, it, expect } from 'vitest';
import { classifyEntries } from '../collisions.js';

const existing = [
  { date: '2026-07-01', kg: 82.5 },
  { date: '2026-07-02', kg: 82.3 },
];

describe('classifyEntries', () => {
  it('classifies a brand-new date as fresh', () => {
    const r = classifyEntries([{ date: '2026-07-05', kg: 81.0 }], existing);
    expect(r.fresh).toHaveLength(1);
    expect(r.unchanged).toHaveLength(0);
    expect(r.conflicting).toHaveLength(0);
  });

  it('classifies an identical weight on an existing date as unchanged', () => {
    const r = classifyEntries([{ date: '2026-07-01', kg: 82.5 }], existing);
    expect(r.unchanged).toHaveLength(1);
    expect(r.unchanged[0].prevKg).toBe(82.5);
    expect(r.fresh).toHaveLength(0);
    expect(r.conflicting).toHaveLength(0);
  });

  it('classifies a differing weight on an existing date as conflicting', () => {
    const r = classifyEntries([{ date: '2026-07-01', kg: 83.0 }], existing);
    expect(r.conflicting).toHaveLength(1);
    expect(r.conflicting[0].prevKg).toBe(82.5);
    expect(r.fresh).toHaveLength(0);
    expect(r.unchanged).toHaveLength(0);
  });

  it('treats values equal after 2dp rounding as unchanged, not conflicting', () => {
    const r = classifyEntries([{ date: '2026-07-01', kg: 82.5004 }], existing);
    expect(r.unchanged).toHaveLength(1);
    expect(r.conflicting).toHaveLength(0);
  });

  it('classifies a mixed batch correctly, one of each kind', () => {
    const r = classifyEntries(
      [
        { date: '2026-07-05', kg: 81.0 },   // fresh
        { date: '2026-07-01', kg: 82.5 },   // unchanged
        { date: '2026-07-02', kg: 80.0 },   // conflicting
      ],
      existing
    );
    expect(r.fresh.map((e) => e.date)).toEqual(['2026-07-05']);
    expect(r.unchanged.map((e) => e.date)).toEqual(['2026-07-01']);
    expect(r.conflicting.map((e) => e.date)).toEqual(['2026-07-02']);
  });

  it('handles empty existing history — everything is fresh', () => {
    const r = classifyEntries([{ date: '2026-07-01', kg: 82.5 }], []);
    expect(r.fresh).toHaveLength(1);
  });

  it('handles an empty incoming batch', () => {
    const r = classifyEntries([], existing);
    expect(r).toEqual({ fresh: [], unchanged: [], conflicting: [] });
  });

  it('tolerates undefined incoming and existing arguments', () => {
    expect(classifyEntries(undefined, undefined)).toEqual({ fresh: [], unchanged: [], conflicting: [] });
  });
});
