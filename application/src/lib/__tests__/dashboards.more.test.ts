import { describe, it, expect } from 'vitest';
import { accessFor, collaborating, viewOnly, landingRoute, memberList } from '../dashboards.js';
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
