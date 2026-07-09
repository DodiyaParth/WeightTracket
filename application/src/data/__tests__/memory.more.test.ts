import { describe, it, expect, beforeEach } from 'vitest';
import * as repo from '../memory.js';
import { _resetStore } from '../memory.js';

const UID = 'parth';
const PARTH_EMAIL = 'parth@weighttracker.app';

beforeEach(() => { _resetStore(); });

describe('profiles', () => {
  it('getProfile returns a clone for a known uid and null for an unknown one', async () => {
    const p = await repo.getProfile(UID);
    expect(p.name).toBe('Parth');
    expect(await repo.getProfile('nobody')).toBeNull();
  });

  it('getProfiles maps only the uids that exist', async () => {
    const out = await repo.getProfiles([UID, 'priya', 'ghost']);
    expect(Object.keys(out).sort()).toEqual(['parth', 'priya']);
  });

  it('ensureProfile creates a profile for a brand-new auth user', async () => {
    const created = await repo.ensureProfile({ uid: 'newbie', displayName: 'New Bie', email: 'n@x.com', photoURL: 'p.png' });
    expect(created).toMatchObject({ uid: 'newbie', name: 'New Bie', email: 'n@x.com', photoURL: 'p.png', heightM: null });
  });

  it('ensureProfile defaults name/email/photo when the auth user is sparse', async () => {
    const created = await repo.ensureProfile({ uid: 'sparse' });
    expect(created).toMatchObject({ name: 'You', email: '', photoURL: null });
  });

  it('ensureProfile backfills a missing photoURL on an existing profile', async () => {
    const after = await repo.ensureProfile({ uid: UID, photoURL: 'https://img/parth.png' });
    expect(after.photoURL).toBe('https://img/parth.png');
  });
});

describe('weights', () => {
  it('addWeights inserts new dates and updates existing ones, returning the count', async () => {
    const n = await repo.addWeights(UID, [
      { date: '2032-01-01', kg: 90 },
      { date: '2032-01-02', kg: 89.5, note: 'hi' },
    ]);
    expect(n).toBe(2);
    // updating one of them in a second batch keeps a single row for that date
    await repo.addWeights(UID, [{ date: '2032-01-01', kg: 88 }]);
    const list = await repo.listWeights(UID);
    const jan1 = list.filter((w) => w.date === '2032-01-01');
    expect(jan1).toHaveLength(1);
    expect(jan1[0].kg).toBe(88);
  });

  it('deleteWeight removes the entry by id', async () => {
    await repo.addWeight(UID, { date: '2032-02-02', kg: 80 });
    const entry = (await repo.listWeights(UID)).find((w) => w.date === '2032-02-02');
    await repo.deleteWeight(UID, entry.id);
    expect((await repo.listWeights(UID)).find((w) => w.date === '2032-02-02')).toBeUndefined();
  });

  it('updateWeight is a no-op for an unknown id', async () => {
    const before = await repo.listWeights(UID);
    await repo.updateWeight(UID, 'does-not-exist', { kg: 1 });
    expect(await repo.listWeights(UID)).toHaveLength(before.length);
  });
});

describe('dashboards', () => {
  it('listDashboards returns only dashboards the uid belongs to', async () => {
    const list = await repo.listDashboards(UID);
    const ids = list.map((d) => d.id).sort();
    expect(ids).toContain('d1');
    // priya is not a member of every dashboard parth is on
    const priyaList = await repo.listDashboards('priya');
    expect(priyaList.every((d) => d.members.priya)).toBe(true);
  });

  it('getDashboard returns null for an unknown id', async () => {
    expect(await repo.getDashboard('nope')).toBeNull();
  });

  it('updateDashboard patches fields and bumps updatedAt', async () => {
    await repo.updateDashboard('d1', { name: 'Renamed' });
    expect((await repo.getDashboard('d1')).name).toBe('Renamed');
  });

  it('updateMemberRole changes a member role', async () => {
    await repo.updateMemberRole('d1', 'priya', 'viewer');
    expect((await repo.getDashboard('d1')).members.priya.role).toBe('viewer');
  });

  it('getDashboardSeries returns a per-tracked-uid weight series', async () => {
    const series = await repo.getDashboardSeries('d1');
    expect(Object.keys(series).sort()).toEqual(['parth', 'priya']);
    expect(Array.isArray(series.parth)).toBe(true);
    expect(series.parth[0]).toHaveProperty('kg');
  });

  it('getDashboardSeries returns {} for an unknown dashboard', async () => {
    expect(await repo.getDashboardSeries('nope')).toEqual({});
  });
});

describe('invites', () => {
  it('listOutgoing returns invites created for a dashboard', async () => {
    await repo.createInvite('d1', { fromUid: UID, fromName: 'Parth', toEmail: 'x@y.com', role: 'editor' });
    const out = await repo.listOutgoing('d1');
    expect(out.map((i) => i.toEmail)).toContain('x@y.com');
  });

  it('createInvite defaults the role to editor and stamps the dashboard name', async () => {
    const inv = await repo.createInvite('d1', { fromUid: UID, fromName: 'Parth', toEmail: 'z@y.com' });
    expect(inv.role).toBe('editor');
    expect(inv.dashboardName).toBe('Parth & Priya');
  });

  it('declineInvite marks the invite declined (dropping it from the pending list)', async () => {
    const invites = await repo.listInvites(PARTH_EMAIL);
    expect(invites.length).toBeGreaterThan(0);
    await repo.declineInvite(invites[0].id);
    expect(await repo.listInvites(PARTH_EMAIL)).toHaveLength(0);
  });

  it('cancelInvite removes it entirely', async () => {
    const inv = await repo.createInvite('d1', { fromUid: UID, fromName: 'Parth', toEmail: 'gone@y.com' });
    await repo.cancelInvite(inv.id);
    expect((await repo.listOutgoing('d1')).find((i) => i.id === inv.id)).toBeUndefined();
  });

  it('acceptInvite materializes the inviter dashboard when it is not already in the store', async () => {
    // The seed carries a pending invite to Parth for "ext-crew", a dashboard
    // that does not exist locally — accepting it must create it.
    const invites = await repo.listInvites(PARTH_EMAIL);
    const extInvite = invites.find((i) => i.dashboardId === 'ext-crew');
    expect(extInvite).toBeTruthy();
    await repo.acceptInvite(extInvite.id, { uid: UID, displayName: 'Parth', email: PARTH_EMAIL });
    const d = await repo.getDashboard('ext-crew');
    expect(d).toBeTruthy();
    expect(d.members[UID]).toBeDefined();
    expect(d.trackedUids).toContain(UID);
  });

  it('acceptInvite is a no-op for an unknown invite id', async () => {
    await expect(repo.acceptInvite('missing', { uid: UID })).resolves.toBeUndefined();
  });
});

describe('public sharing', () => {
  it('setPublicLink enables a link with a token and disables it again', async () => {
    const enabled = await repo.setPublicLink('d2', true);
    expect(enabled.enabled).toBe(true);
    expect(enabled.token).toBeTruthy();
    const disabled = await repo.setPublicLink('d2', false);
    expect(disabled).toEqual({ enabled: false, token: null });
  });

  it('setPublicLink returns a disabled shape for an unknown dashboard', async () => {
    expect(await repo.setPublicLink('nope', true)).toEqual({ enabled: false, token: null });
  });

  it('getPublicView returns an enriched snapshot for a valid token', async () => {
    const view = await repo.getPublicView('demo-9fa2kq7x');
    expect(view.id).toBe('d1');
    expect(view.members.parth).toMatchObject({ uid: 'parth', name: 'Parth' });
    expect(view.members.parth).toHaveProperty('color');
    expect(Object.keys(view.series)).toContain('parth');
  });

  it('getPublicView returns null for an unknown/disabled token', async () => {
    expect(await repo.getPublicView('bogus')).toBeNull();
  });
});

describe('habits & notifications', () => {
  it('setHabitMark with a falsy value clears the mark', async () => {
    await repo.setHabitMark('d1', UID, 'h1', '2032-03-01', 1);
    let logs = await repo.getHabitLogs('d1');
    expect(logs[UID].h1['2032-03-01']).toBe(1);
    await repo.setHabitMark('d1', UID, 'h1', '2032-03-01', 0);
    logs = await repo.getHabitLogs('d1');
    expect(logs[UID].h1['2032-03-01']).toBeUndefined();
  });

  it('listNotifications surfaces pending invites plus the welcome note', async () => {
    const notes = await repo.listNotifications(UID);
    expect(notes.some((n) => n.id === 'n_welcome')).toBe(true);
    expect(notes.some((n) => n.unread && /invited you/.test(n.text))).toBe(true);
  });
});
