import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// One fake repo whose every method resolves; a synchronous bus is enough here.
vi.mock('../../data/repo.js', () => {
  const listeners = new Set();
  return {
    repo: {
      getProfile: vi.fn().mockResolvedValue({ uid: 'u1' }),
      getProfiles: vi.fn().mockResolvedValue({ u1: { uid: 'u1' } }),
      listWeights: vi.fn().mockResolvedValue([{ id: 'w1' }]),
      listDashboards: vi.fn().mockResolvedValue([{ id: 'd1' }]),
      getDashboard: vi.fn().mockResolvedValue({ id: 'd1' }),
      getDashboardSeries: vi.fn().mockResolvedValue({ u1: [] }),
      getHabitLogs: vi.fn().mockResolvedValue({ u1: {} }),
      listNsv: vi.fn().mockResolvedValue({ u1: [] }),
      listInvites: vi.fn().mockResolvedValue([{ id: 'i1' }]),
      listNotifications: vi.fn().mockResolvedValue([{ id: 'n1' }]),
    },
    bus: {
      subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      emit: () => listeners.forEach((fn) => fn()),
    },
  };
});

import {
  useProfiles, useWeights, useDashboards, useDashboard, useDashboardSeries,
  useHabitLogs, useNsv, useInvites, useNotifications,
} from '../useData.js';
import { repo } from '../../data/repo.js';

beforeEach(() => { vi.clearAllMocks(); });

// [hook, arg, repoMethod, emptyArg, emptyDefault]
const cases = [
  [useProfiles, ['u1'], 'getProfiles', [], {}],
  [useWeights, 'u1', 'listWeights', null, []],
  [useDashboards, 'u1', 'listDashboards', null, []],
  [useDashboard, 'd1', 'getDashboard', null, null],
  [useDashboardSeries, 'd1', 'getDashboardSeries', null, {}],
  [useHabitLogs, 'd1', 'getHabitLogs', null, {}],
  [useNsv, 'd1', 'listNsv', null, {}],
  [useInvites, 'a@b.com', 'listInvites', null, []],
  [useNotifications, 'u1', 'listNotifications', null, []],
];

describe.each(cases)('%o', (hook, arg, method, emptyArg, emptyDefault) => {
  it(`fetches via repo.${method} when given an argument`, async () => {
    const { result } = renderHook(() => hook(arg));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(repo[method]).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(null);
    expect(result.current.data).toBeDefined();
  });

  it(`returns the empty default without calling repo.${method} when the argument is missing`, async () => {
    const { result } = renderHook(() => hook(emptyArg));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(repo[method]).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(emptyDefault);
  });
});

describe('useAsync error path', () => {
  it('captures a rejected fetch as error state', async () => {
    repo.listWeights.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useWeights('u1'));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });
});

describe('useProfiles — key building', () => {
  it('tolerates an undefined uid list and resolves to {} without calling the repo', async () => {
    const { result } = renderHook(() => useProfiles(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(repo.getProfiles).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({});
  });
});

// The request-id guard is the reason two views can refetch without clobbering
// each other — a slow, superseded fetch must never overwrite fresh data.
describe('useAsync — stale request guard', () => {
  it('drops a late-resolving response once the deps have moved on', async () => {
    let resolveFirst;
    repo.listWeights
      .mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }))
      .mockResolvedValueOnce([{ id: 'fresh' }]);

    const { result, rerender } = renderHook(({ uid }) => useWeights(uid), { initialProps: { uid: 'u1' } });
    rerender({ uid: 'u2' });
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'fresh' }]));

    await act(async () => { resolveFirst([{ id: 'stale' }]); await Promise.resolve(); });
    expect(result.current.data).toEqual([{ id: 'fresh' }]);
  });

  it('drops a late rejection once the deps have moved on', async () => {
    let rejectFirst;
    repo.listWeights
      .mockReturnValueOnce(new Promise((_res, rej) => { rejectFirst = rej; }))
      .mockResolvedValueOnce([{ id: 'fresh' }]);

    const { result, rerender } = renderHook(({ uid }) => useWeights(uid), { initialProps: { uid: 'u1' } });
    rerender({ uid: 'u2' });
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'fresh' }]));

    await act(async () => { rejectFirst(new Error('stale')); await Promise.resolve(); });
    expect(result.current.error).toBe(null);
    expect(result.current.data).toEqual([{ id: 'fresh' }]);
  });
});
