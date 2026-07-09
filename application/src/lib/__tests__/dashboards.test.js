import { describe, it, expect } from 'vitest';
import { accessFor, isEditable, collaborating, viewOnly, recents, landingRoute, memberList, colorForMember, ACCESS } from '../dashboards.js';
import { PERSON_COLORS } from '../colors.js';
import { DAY_MS } from '../date.js';

const now = 1_700_000_000_000;
const d = (id, ownerUid, members, updatedAgoDays) => ({
  id, ownerUid, members, updatedAt: now - updatedAgoDays * DAY_MS,
});
const me = 'u_me';
const dashes = [
  d('own', me, { [me]: { uid: me, role: 'owner' } }, 1),
  d('edit', 'u_x', { [me]: { uid: me, role: 'editor' }, u_x: { uid: 'u_x', role: 'owner' } }, 3),
  d('view', 'u_y', { [me]: { uid: me, role: 'viewer' }, u_y: { uid: 'u_y', role: 'owner' } }, 2),
  d('stale', 'u_z', { [me]: { uid: me, role: 'editor' } }, 20),
];

describe('access model', () => {
  it('resolves owner / editor / viewer', () => {
    expect(accessFor(dashes[0], me)).toBe('owner');
    expect(accessFor(dashes[1], me)).toBe('editor');
    expect(accessFor(dashes[2], me)).toBe('viewer');
    expect(ACCESS[accessFor(dashes[2], me)].editable).toBe(false);
    expect(isEditable(dashes[1], me)).toBe(true);
  });
});

describe('list split + recents', () => {
  it('separates collaborating (editable) from view-only', () => {
    expect(collaborating(dashes, me).map((x) => x.id)).toEqual(['own', 'edit', 'stale']);
    expect(viewOnly(dashes, me).map((x) => x.id)).toEqual(['view']);
  });
  it('recents put collaboration first, newest first, capped', () => {
    expect(recents(dashes, me, 3).map((x) => x.id)).toEqual(['own', 'edit', 'stale']);
  });
});

describe('landingRoute (§11.2)', () => {
  it('opens the most-recent collaboration dashboard within 7 days', () => {
    expect(landingRoute(dashes, me, now)).toBe('/dashboard/own');
  });
  it('falls back to a recent view-only when no recent collaboration', () => {
    const onlyView = [d('view', 'u_y', { [me]: { uid: me, role: 'viewer' } }, 2), d('stale', 'u_z', { [me]: { uid: me, role: 'editor' } }, 30)];
    expect(landingRoute(onlyView, me, now)).toBe('/dashboard/view');
  });
  it('falls back to the list when nothing is recent', () => {
    const allStale = [d('stale', 'u_z', { [me]: { uid: me, role: 'editor' } }, 30)];
    expect(landingRoute(allStale, me, now)).toBe('/');
    expect(landingRoute([], me, now)).toBe('/');
  });
});

// The members map stores only uid/role/joinedAt (never a copy of name/email/
// photoURL/heightM/color/initial — see FEEDBACK-phases.md / the "don't store
// what's derivable" fix). memberList joins it against a live profiles map.
describe('memberList — derives display fields from live profiles, never storage', () => {
  const dash = {
    ownerUid: 'owner1',
    members: {
      owner1: { uid: 'owner1', role: 'owner', joinedAt: 1000 },
      member2: { uid: 'member2', role: 'editor', joinedAt: 2000 },
    },
  };
  const profiles = {
    owner1: { name: 'Ada Lovelace', email: 'ada@x.com', heightM: 1.7 },
    member2: { name: 'Grace Hopper', email: 'grace@x.com', heightM: 1.65 },
  };

  it('orders owner first, then by joinedAt', () => {
    const list = memberList(dash, profiles);
    expect(list.map((m) => m.uid)).toEqual(['owner1', 'member2']);
  });

  it('joins name/email/heightM from the live profiles map, not the member record', () => {
    const list = memberList(dash, profiles);
    expect(list[0]).toMatchObject({ uid: 'owner1', role: 'owner', name: 'Ada Lovelace', email: 'ada@x.com', heightM: 1.7 });
    expect(list[1]).toMatchObject({ uid: 'member2', role: 'editor', name: 'Grace Hopper', heightM: 1.65 });
  });

  it('derives initials from the live profile name', () => {
    const list = memberList(dash, profiles);
    expect(list[0].initial).toBe('AL');
    expect(list[1].initial).toBe('GH');
  });

  it('assigns color by position (owner gets the first color), regardless of who they are', () => {
    const list = memberList(dash, profiles);
    expect(list[0].color).toBe(PERSON_COLORS[0]);
    expect(list[1].color).toBe(PERSON_COLORS[1]);
  });

  it('reflects a profile update immediately — no stale copy to go out of sync (the reported BMI bug)', () => {
    const before = memberList(dash, profiles);
    expect(before[0].heightM).toBe(1.7);
    const updatedProfiles = { ...profiles, owner1: { ...profiles.owner1, heightM: 1.82 } };
    const after = memberList(dash, updatedProfiles);
    expect(after[0].heightM).toBe(1.82);
  });

  it('falls back to fields already on the member record when no profiles map is given (public-snapshot shape)', () => {
    const publicDash = {
      ownerUid: 'owner1',
      members: {
        owner1: { uid: 'owner1', role: 'owner', joinedAt: 1000, name: 'Snapshot Name', heightM: 1.7, photoURL: null, color: PERSON_COLORS[0], initial: 'SN' },
      },
    };
    const list = memberList(publicDash); // no profiles arg — as PublicView.jsx calls it
    expect(list[0]).toMatchObject({ name: 'Snapshot Name', heightM: 1.7 });
  });

  it('handles a missing/never-loaded profile without crashing', () => {
    const list = memberList(dash, {});
    expect(list[0].name).toBe('Member');
    expect(list[0].initial).toBe('?');
    expect(list[0].heightM).toBeNull();
  });
});

describe('colorForMember — position-based color without needing a profile fetch', () => {
  const dash = {
    ownerUid: 'owner1',
    members: {
      owner1: { uid: 'owner1', role: 'owner', joinedAt: 1000 },
      member2: { uid: 'member2', role: 'editor', joinedAt: 2000 },
    },
  };
  it('matches memberList\'s color for the same uid', () => {
    expect(colorForMember(dash, 'owner1')).toBe(PERSON_COLORS[0]);
    expect(colorForMember(dash, 'member2')).toBe(PERSON_COLORS[1]);
  });
  it('falls back to the first color for an unknown uid', () => {
    expect(colorForMember(dash, 'nobody')).toBe(PERSON_COLORS[0]);
  });
});
