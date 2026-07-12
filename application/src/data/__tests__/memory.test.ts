import { describe, it, expect, beforeEach } from 'vitest';
import * as repo from '../memory.js';
import { _resetStore } from '../memory.js';
import { memberList } from '../../lib/dashboards.js';

const UID = 'parth'; // seeded user — has existing weight history

describe('updateWeight — date changes move the entry, they never duplicate it (DEV-3)', () => {
  beforeEach(() => { _resetStore(); });

  it('a same-date edit just patches kg/note in place', async () => {
    await repo.addWeight(UID, { date: '2031-01-01', kg: 80, note: '' });
    const before = (await repo.listWeights(UID)).find((w) => w.date === '2031-01-01');
    await repo.updateWeight(UID, before.id, { kg: 79.5, date: '2031-01-01' });
    const after = await repo.listWeights(UID);
    const match = after.filter((w) => w.date === '2031-01-01');
    expect(match).toHaveLength(1);
    expect(match[0].kg).toBe(79.5);
  });

  it('changing the date moves the entry — old date is gone, no duplicate at the new date', async () => {
    await repo.addWeight(UID, { date: '2031-01-01', kg: 80, note: '' });
    const entry = (await repo.listWeights(UID)).find((w) => w.date === '2031-01-01');

    await repo.updateWeight(UID, entry.id, { date: '2031-01-05', kg: 80, note: '' });

    const after = await repo.listWeights(UID);
    expect(after.find((w) => w.date === '2031-01-01')).toBeUndefined();
    const moved = after.filter((w) => w.date === '2031-01-05');
    expect(moved).toHaveLength(1);
    expect(moved[0].kg).toBe(80);
  });

  it('moving to a date that already has an entry throws instead of silently duplicating', async () => {
    await repo.addWeight(UID, { date: '2031-01-01', kg: 80, note: '' });
    await repo.addWeight(UID, { date: '2031-01-05', kg: 79, note: '' });
    const entry = (await repo.listWeights(UID)).find((w) => w.date === '2031-01-01');

    expect(() => repo.updateWeight(UID, entry.id, { date: '2031-01-05', kg: 80, note: '' })).toThrow();

    // both original entries are untouched — no silent overwrite, no duplicate
    const after = await repo.listWeights(UID);
    expect(after.filter((w) => w.date === '2031-01-01')).toHaveLength(1);
    expect(after.filter((w) => w.date === '2031-01-05')).toHaveLength(1);
    expect(after.find((w) => w.date === '2031-01-05').kg).toBe(79);
  });
});

describe('dashboards never store denormalized profile fields — a height edit is visible with no fan-out write', () => {
  beforeEach(() => { _resetStore(); });

  it('createDashboard stores only uid/role/joinedAt for the owner', async () => {
    const d = await repo.createDashboard(UID, { name: 'Test dash' });
    expect(Object.keys(d.members[UID]).sort()).toEqual(['joinedAt', 'role', 'uid']);
  });

  it('editing height in Profile is reflected the next time the dashboard is read — the reported bug', async () => {
    const d = await repo.createDashboard(UID, { name: 'Test dash' });

    // Before: whatever height was seeded.
    const beforeProfiles = await repo.getProfiles([UID]);
    const beforeList = memberList(d, beforeProfiles);
    const originalHeight = beforeList[0].heightM;

    // User edits height in Profile — this is the ONLY write; nothing touches the dashboard.
    await repo.updateProfile(UID, { heightM: 1.99 });

    // Re-reading the dashboard + a fresh profile fetch (exactly what the
    // DashboardDetail → useProfiles refetch-after-invalidation path does) must
    // show the new height with no dashboard-side write in between.
    const dashAfter = await repo.getDashboard(d.id);
    const profilesAfter = await repo.getProfiles([UID]);
    const afterList = memberList(dashAfter, profilesAfter);

    expect(afterList[0].heightM).toBe(1.99);
    expect(afterList[0].heightM).not.toBe(originalHeight);
  });

  it('acceptInvite stores only uid/role/joinedAt for the new member', async () => {
    const owner = await repo.createDashboard(UID, { name: 'Test dash' });
    await repo.createInvite(owner.id, { fromUid: UID, fromName: 'Parth', toEmail: 'priya@weighttracker.app', role: 'editor' });
    const invites = await repo.listInvites('priya@weighttracker.app');
    await repo.acceptInvite(invites[0].id, { uid: 'priya', displayName: 'Priya', email: 'priya@weighttracker.app' });
    const d = await repo.getDashboard(owner.id);
    expect(Object.keys(d.members.priya).sort()).toEqual(['joinedAt', 'role', 'uid']);
  });
});

describe('delete/leave/rename gaps (DEV-7, DEV-9)', () => {
  beforeEach(() => { _resetStore(); });

  it('removeMember drops the member from members and trackedUids', async () => {
    const owner = await repo.createDashboard(UID, { name: 'Test dash' });
    await repo.createInvite(owner.id, { fromUid: UID, fromName: 'Parth', toEmail: 'priya@weighttracker.app', role: 'editor' });
    const invites = await repo.listInvites('priya@weighttracker.app');
    await repo.acceptInvite(invites[0].id, { uid: 'priya', displayName: 'Priya', email: 'priya@weighttracker.app' });

    await repo.removeMember(owner.id, 'priya');

    const d = await repo.getDashboard(owner.id);
    expect(d.members.priya).toBeUndefined();
    expect(d.trackedUids).not.toContain('priya');
    expect(d.members[UID]).toBeDefined(); // owner untouched
  });

  it('deleteDashboard removes the dashboard and its habitLogs/nsv', async () => {
    const owner = await repo.createDashboard(UID, { name: 'Test dash' });
    await repo.addNsv(owner.id, UID, { date: '2031-01-01', text: 'a win' });

    await repo.deleteDashboard(owner.id);

    expect(await repo.getDashboard(owner.id)).toBeNull();
    expect(await repo.listNsv(owner.id)).toEqual({});
  });

  it('deleteNsv removes only the targeted note', async () => {
    const owner = await repo.createDashboard(UID, { name: 'Test dash' });
    await repo.addNsv(owner.id, UID, { date: '2031-01-01', text: 'keep me' });
    await repo.addNsv(owner.id, UID, { date: '2031-01-02', text: 'delete me' });
    const before = await repo.listNsv(owner.id);
    const toDelete = before[UID].find((n) => n.text === 'delete me');

    await repo.deleteNsv(owner.id, toDelete.id);

    const after = await repo.listNsv(owner.id);
    expect(after[UID].map((n) => n.text)).toEqual(['keep me']);
  });
});

describe('setHabitMark auto-grace (DEV-20)', () => {
  beforeEach(() => { _resetStore(); });

  it('forgives a single missed day when marking a habit done', async () => {
    const owner = await repo.createDashboard(UID, { name: 'Test dash' });
    await repo.setHabitMark(owner.id, UID, 'h1', '2031-01-01', 1);
    // 2031-01-02 missed
    await repo.setHabitMark(owner.id, UID, 'h1', '2031-01-03', 1);

    const logs = await repo.getHabitLogs(owner.id);
    expect(logs[UID].h1['2031-01-02']).toBe(2); // GRACE
  });

  it('does not forgive a real two-day gap', async () => {
    const owner = await repo.createDashboard(UID, { name: 'Test dash' });
    await repo.setHabitMark(owner.id, UID, 'h1', '2031-01-01', 1);
    await repo.setHabitMark(owner.id, UID, 'h1', '2031-01-04', 1);

    const logs = await repo.getHabitLogs(owner.id);
    expect(logs[UID].h1['2031-01-02']).toBeUndefined();
    expect(logs[UID].h1['2031-01-03']).toBeUndefined();
  });
});
