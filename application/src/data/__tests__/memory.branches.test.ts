import { describe, it, expect, beforeEach } from 'vitest';
import * as repo from '../memory.js';
import { _resetStore } from '../memory.js';

const UID = 'parth';

beforeEach(() => { _resetStore(); });

describe('memory — empty/unknown fallbacks (defensive branches)', () => {
  it('trackedSeries yields [] for a tracked user with no weights', async () => {
    const d = await repo.createDashboard('fresh_uid', { name: 'Solo' });
    const series = await repo.getDashboardSeries(d.id);
    expect(series.fresh_uid).toEqual([]);
  });

  it('listWeights returns [] for an unknown uid', async () => {
    expect(await repo.listWeights('ghost')).toEqual([]);
  });

  it('addWeight seeds a fresh uid, then updates in place on the same date', async () => {
    await repo.addWeight('fresh2', { date: '2033-01-01', kg: 70 });
    await repo.addWeight('fresh2', { date: '2033-01-01', kg: 71, note: 'x' });
    const list = await repo.listWeights('fresh2');
    expect(list).toHaveLength(1);
    expect(list[0].kg).toBe(71);
  });

  it('addWeights seeds a fresh uid', async () => {
    const n = await repo.addWeights('fresh3', [{ date: '2033-02-01', kg: 60 }]);
    expect(n).toBe(1);
  });

  it('updateWeight / deleteWeight no-op for an unknown uid', async () => {
    await expect(repo.updateWeight('ghost', 'x', { kg: 1 })).resolves.toBeUndefined();
    await expect(repo.deleteWeight('ghost', 'x')).resolves.toBeUndefined();
  });

  it('ensureProfile leaves an existing profile untouched when no photoURL is supplied', async () => {
    const p = await repo.ensureProfile({ uid: UID });
    expect(p.uid).toBe(UID);
  });
});

describe('memory — dashboard create defaults + unknown-id guards', () => {
  it('createDashboard defaults the name and builds a team goal from label/target', async () => {
    const noName = await repo.createDashboard(UID, {});
    expect(noName.name).toBe('New dashboard');
    expect(noName.teamGoal).toBeNull();

    const withGoal = await repo.createDashboard(UID, { name: 'Team', teamGoalLabel: 'Lose 10', teamGoalTarget: '5' });
    expect(withGoal.teamGoal).toEqual({ label: 'Lose 10', target: 5 });

    const badTarget = await repo.createDashboard(UID, { name: 'Team2', teamGoalLabel: 'Lose', teamGoalTarget: 'abc' });
    expect(badTarget.teamGoal.target).toBe(10); // Number('abc') || 10
  });

  it('updateDashboard / updateMemberRole / removeMember no-op for unknown ids', async () => {
    await expect(repo.updateDashboard('nope', { name: 'x' })).resolves.toBeUndefined();
    await expect(repo.updateMemberRole('nope', 'u', 'viewer')).resolves.toBeUndefined();
    await expect(repo.updateMemberRole('d1', 'ghost', 'viewer')).resolves.toBeUndefined();
    await expect(repo.removeMember('nope', 'u')).resolves.toBeUndefined();
  });
});

describe('memory — habits / nsv / invites unknown-id guards', () => {
  it('getHabitLogs returns {} and setHabitMark no-ops for an unknown dashboard', async () => {
    expect(await repo.getHabitLogs('nope')).toEqual({});
    await expect(repo.setHabitMark('nope', UID, 'h1', '2033-01-01', 1)).resolves.toBeUndefined();
  });

  it('addNsv defaults the date and tolerates an unknown dashboard', async () => {
    await expect(repo.addNsv('nope', UID, { text: 'win' })).resolves.toBeUndefined();
    const owner = await repo.createDashboard(UID, { name: 'D' });
    await repo.addNsv(owner.id, UID, { text: 'no-date win' });
    const nsv = await repo.listNsv(owner.id);
    expect(nsv[UID][0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('deleteNsv tolerates an unknown dashboard', async () => {
    await expect(repo.deleteNsv('nope', 'n1')).resolves.toBeUndefined();
  });

  it('createInvite falls back to "a dashboard" name for an unknown dashboard', async () => {
    const inv = await repo.createInvite('nope', { fromUid: UID, fromName: 'P', toEmail: 'x@y.com' });
    expect(inv.dashboardName).toBe('a dashboard');
  });

  it('declineInvite no-ops for an unknown invite', async () => {
    await expect(repo.declineInvite('missing')).resolves.toBeUndefined();
  });

  it('acceptInvite does not double-track a user who is already tracked', async () => {
    const owner = await repo.createDashboard(UID, { name: 'Self' });
    const inv = await repo.createInvite(owner.id, { fromUid: UID, fromName: 'P', toEmail: 'self@x.com', role: 'editor' });
    await repo.acceptInvite(inv.id, { uid: UID, email: 'self@x.com' });
    const d = await repo.getDashboard(owner.id);
    expect(d.trackedUids.filter((u) => u === UID)).toHaveLength(1);
  });
});

describe('memory — public view without profiles / logs', () => {
  it('enriches a member that has no live profile and defaults empty habitLogs/nsv', async () => {
    const owner = await repo.createDashboard(UID, { name: 'Pub' });
    await repo.updateDashboard(owner.id, {
      members: {
        [UID]: { uid: UID, role: 'owner', joinedAt: 1 },
        ghost: { uid: 'ghost', role: 'viewer', joinedAt: 2 },
      },
      trackedUids: [UID],
    });
    const link = await repo.setPublicLink(owner.id, true);
    const view = await repo.getPublicView(link.token);
    expect(view.members.ghost).toBeDefined();
    expect(view.members.ghost.name).toBe('Member'); // derived, no live profile
    expect(view.habitLogs).toEqual({});
    expect(view.nsv).toEqual({});
  });
});
