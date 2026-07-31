import { describe, it, expect } from 'vitest';
import { accessFor, collaborating, viewOnly, landingRoute, memberList, resolveStart, deriveTeamGoal } from '../dashboards.js';
import { PERSON_COLORS } from '../colors.js';

describe('accessFor — edge cases', () => {
  it('treats a missing dashboard or unknown member as viewer', () => {
    expect(accessFor(null, 'u1')).toBe('viewer');
    expect(accessFor({ ownerUid: 'other', members: {} }, 'u1')).toBe('viewer');
  });
  it('honours an explicit editor/owner role in the members map', () => {
    expect(accessFor({ ownerUid: 'other', members: { u1: { uid: 'u1', role: 'editor' } } }, 'u1')).toBe('editor');
    expect(accessFor({ ownerUid: 'other', members: { u1: { uid: 'u1', role: 'owner' } } }, 'u1')).toBe('owner');
  });
});

describe('list splitting — undefined + missing updatedAt', () => {
  it('tolerates an undefined dashboards list', () => {
    expect(collaborating(undefined, 'u1')).toEqual([]);
    expect(viewOnly(undefined, 'u1')).toEqual([]);
  });
  it('sorts dashboards that have no updatedAt without crashing', () => {
    const list = [
      { id: 'a', ownerUid: 'u1', members: { u1: { uid: 'u1', role: 'owner' } } },
      { id: 'b', ownerUid: 'u1', members: { u1: { uid: 'u1', role: 'owner' } }, updatedAt: 10 },
    ];
    const ids = collaborating(list, 'u1').map((d) => d.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
  });
});

describe('landingRoute — missing updatedAt', () => {
  it('treats a dashboard with no updatedAt as stale (0) and returns the list', () => {
    const list = [{ id: 'x', ownerUid: 'u1', members: { u1: { uid: 'u1', role: 'owner' } } }];
    expect(landingRoute(list, 'u1', 8 * 86400000)).toBe('/');
  });
});

describe('memberList / sortedMembers — ordering + no members', () => {
  it('returns an empty list when the dashboard has no members', () => {
    expect(memberList({ ownerUid: 'u1' })).toEqual([]);
  });
  it('orders the owner first even when listed later, and sorts the rest by joinedAt', () => {
    const dash = {
      ownerUid: 'owner1',
      members: {
        editorB: { uid: 'editorB', role: 'editor', joinedAt: 3000 },
        editorA: { uid: 'editorA', role: 'editor' }, // no joinedAt → treated as 0
        owner1: { uid: 'owner1', role: 'owner', joinedAt: 1000 },
      },
    };
    const list = memberList(dash, {});
    expect(list.map((m) => m.uid)).toEqual(['owner1', 'editorA', 'editorB']);
    expect(list[0].color).toBe(PERSON_COLORS[0]);
  });
});

describe('resolveStart', () => {
  it('uses the weigh-in on startISO when present', () => {
    const entries = [{ date: '2026-01-01', kg: 88 }, { date: '2026-06-01', kg: 84 }];
    expect(resolveStart({ startISO: '2026-01-01', targetKg: 80 }, entries)).toEqual({ startISO: '2026-01-01', startKg: 88 });
  });
  it('returns a null startKg when startISO has no weigh-in (no snapping)', () => {
    const entries = [{ date: '2026-01-02', kg: 88 }];
    expect(resolveStart({ startISO: '2026-01-01', targetKg: 80 }, entries)).toEqual({ startISO: '2026-01-01', startKg: null });
  });
  it('falls back to the earliest weigh-in for a legacy goal with no startISO', () => {
    const entries = [{ date: '2026-01-01', kg: 90 }, { date: '2026-02-01', kg: 88 }];
    expect(resolveStart({ targetKg: 80 }, entries)).toEqual({ startISO: '2026-01-01', startKg: 90 });
  });
  it('is all-null with no entries', () => {
    expect(resolveStart({ targetKg: 80 }, [])).toEqual({ startISO: null, startKg: null });
  });
});

describe('deriveTeamGoal', () => {
  // PRD §4 worked example: Parth 88→80 (loss Δ8, moved 4), Priya 55→58 (gain Δ3, moved 1).
  const mixedDash = {
    trackedUids: ['parth', 'priya'],
    goals: {
      parth: { startISO: '2026-01-01', targetKg: 80, targetISO: '2026-09-30' },
      priya: { startISO: '2026-02-01', targetKg: 58, targetISO: '2026-12-31' },
    },
  };
  const mixedSeries = {
    parth: [{ date: '2026-01-01', kg: 88 }, { date: '2026-06-01', kg: 84 }],
    priya: [{ date: '2026-02-01', kg: 55 }, { date: '2026-06-01', kg: 56 }],
  };

  it('sums absolute change across directions and reports the worked example', () => {
    const tg = deriveTeamGoal(mixedDash, mixedSeries);
    expect(tg.targetKg).toBe(11);
    expect(tg.progressKg).toBe(5);
    expect(tg.pct).toBeCloseTo(5 / 11, 5);
    expect(tg.direction).toBe('mixed');
    expect(tg.label).toBe('11 kg of combined change together');
    expect(tg.targetISO).toBe('2026-12-31'); // the later of the two
  });

  it('labels an all-loss team "Lose N kg together"', () => {
    const dash = {
      trackedUids: ['a', 'b'],
      goals: { a: { startISO: '2026-01-01', targetKg: 80 }, b: { startISO: '2026-01-01', targetKg: 70 } },
    };
    const series = {
      a: [{ date: '2026-01-01', kg: 88 }],
      b: [{ date: '2026-01-01', kg: 75 }],
    };
    expect(deriveTeamGoal(dash, series).label).toBe('Lose 13 kg together');
  });

  it('labels an all-gain team "Gain N kg together"', () => {
    const dash = {
      trackedUids: ['a', 'b'],
      goals: { a: { startISO: '2026-01-01', targetKg: 62 }, b: { startISO: '2026-01-01', targetKg: 58 } },
    };
    const series = {
      a: [{ date: '2026-01-01', kg: 58 }],
      b: [{ date: '2026-01-01', kg: 55 }],
    };
    expect(deriveTeamGoal(dash, series).label).toBe('Gain 7 kg together');
  });

  it('returns null for a solo dashboard (only one member with a goal)', () => {
    const dash = { trackedUids: ['a', 'b'], goals: { a: { startISO: '2026-01-01', targetKg: 80 } } };
    const series = { a: [{ date: '2026-01-01', kg: 88 }], b: [{ date: '2026-01-01', kg: 70 }] };
    expect(deriveTeamGoal(dash, series)).toBeNull();
  });

  it('excludes members whose start weigh-in is missing', () => {
    const dash = {
      trackedUids: ['a', 'b'],
      goals: { a: { startISO: '2026-01-01', targetKg: 80 }, b: { startISO: '2026-01-01', targetKg: 70 } },
    };
    // b's startISO has no matching weigh-in → excluded → only 1 contributor → null
    const series = { a: [{ date: '2026-01-01', kg: 88 }], b: [{ date: '2026-03-01', kg: 75 }] };
    expect(deriveTeamGoal(dash, series)).toBeNull();
  });

  it('clamps a member moving the wrong way to zero progress', () => {
    const dash = {
      trackedUids: ['a', 'b'],
      goals: { a: { startISO: '2026-01-01', targetKg: 80 }, b: { startISO: '2026-01-01', targetKg: 70 } },
    };
    const series = {
      a: [{ date: '2026-01-01', kg: 88 }, { date: '2026-06-01', kg: 90 }], // gained instead of losing
      b: [{ date: '2026-01-01', kg: 75 }, { date: '2026-06-01', kg: 73 }], // moved 2 of 5
    };
    const tg = deriveTeamGoal(dash, series);
    expect(tg.progressKg).toBe(2); // a contributes 0, b contributes 2
  });
});
