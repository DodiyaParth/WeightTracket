import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

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
