import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// One fake repo whose every method resolves.
vi.mock('../../data/repo.js', () => ({
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
    listOutgoing: vi.fn().mockResolvedValue([{ id: 'o1' }]),
    getPublicView: vi.fn().mockResolvedValue({ name: 'Shared' }),
  },
}));

import {
  useProfiles, useWeights, useDashboards, useDashboard, useDashboardSeries,
  useHabitLogs, useNsv, useInvites, useNotifications, useOutgoingInvites, usePublicView,
} from '../useData.js';
import { repo } from '../../data/repo.js';

beforeEach(() => { vi.clearAllMocks(); });

// A fresh QueryClient per render — no cache bleed between assertions/cases,
// mirrors the isolation the old per-hook `useState` gave each renderHook call.
function wrapperFor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// [hook, arg, repoMethod, emptyArg, emptyDefault]
const cases = [
  [useProfiles, ['u1'], 'getProfiles', [], {}],
  [useWeights, 'u1', 'listWeights', undefined, []],
  [useDashboards, 'u1', 'listDashboards', undefined, []],
  [useDashboard, 'd1', 'getDashboard', undefined, null],
  [useDashboardSeries, 'd1', 'getDashboardSeries', undefined, {}],
  [useHabitLogs, 'd1', 'getHabitLogs', undefined, {}],
  [useNsv, 'd1', 'listNsv', undefined, {}],
  [useInvites, 'a@b.com', 'listInvites', undefined, []],
  [useNotifications, 'u1', 'listNotifications', undefined, []],
  [useOutgoingInvites, 'd1', 'listOutgoing', undefined, []],
  [usePublicView, 'tok1', 'getPublicView', undefined, null],
] as const;

describe.each(cases)('%o', (hook, arg, method, emptyArg, emptyDefault) => {
  it(`fetches via repo.${method} when given an argument`, async () => {
    const { result } = renderHook(() => hook(arg as never), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(repo[method]).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe(null);
    expect(result.current.data).toBeDefined();
  });

  it(`returns the empty default without calling repo.${method} when the argument is missing`, async () => {
    const { result } = renderHook(() => hook(emptyArg as never), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(repo[method]).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(emptyDefault);
  });
});

describe('useWeights error path', () => {
  it('captures a rejected fetch as error state', async () => {
    repo.listWeights.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useWeights('u1'), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });
});

describe('useProfiles — key building', () => {
  it('tolerates an undefined uid list and resolves to {} without calling the repo', async () => {
    const { result } = renderHook(() => useProfiles(undefined), { wrapper: wrapperFor() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(repo.getProfiles).not.toHaveBeenCalled();
    expect(result.current.data).toEqual({});
  });
});

// TanStack Query keys each request by its queryKey (here, the uid), so a
// slow, superseded fetch for the old key can never clobber the new key's
// fresh data — the same guarantee the old useAsync request-id counter gave,
// now provided by the cache itself.
describe('useWeights — stale request guard', () => {
  it('drops a late-resolving response once the deps have moved on', async () => {
    let resolveFirst: (v: unknown) => void;
    repo.listWeights
      .mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }))
      .mockResolvedValueOnce([{ id: 'fresh' }]);

    const { result, rerender } = renderHook(({ uid }) => useWeights(uid), {
      initialProps: { uid: 'u1' },
      wrapper: wrapperFor(),
    });
    rerender({ uid: 'u2' });
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'fresh' }]));

    await act(async () => { resolveFirst([{ id: 'stale' }]); await Promise.resolve(); });
    expect(result.current.data).toEqual([{ id: 'fresh' }]);
  });

  it('drops a late rejection once the deps have moved on', async () => {
    let rejectFirst: (e: unknown) => void;
    repo.listWeights
      .mockReturnValueOnce(new Promise((_res, rej) => { rejectFirst = rej; }))
      .mockResolvedValueOnce([{ id: 'fresh' }]);

    const { result, rerender } = renderHook(({ uid }) => useWeights(uid), {
      initialProps: { uid: 'u1' },
      wrapper: wrapperFor(),
    });
    rerender({ uid: 'u2' });
    await waitFor(() => expect(result.current.data).toEqual([{ id: 'fresh' }]));

    await act(async () => { rejectFirst(new Error('stale')); await Promise.resolve(); });
    expect(result.current.error).toBe(null);
    expect(result.current.data).toEqual([{ id: 'fresh' }]);
  });
});
