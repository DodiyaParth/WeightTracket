import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Replace the whole data layer so no Firestore/Firebase is touched.
vi.mock('../../data/repo.js', () => ({
  repo: { getProfile: vi.fn() },
}));

import { useProfile } from '../useData.js';
import { repo } from '../../data/repo.js';

// A fresh QueryClient per test — no cache bleed between assertions, mirrors
// the isolation the old per-hook `useState` gave each renderHook call.
function withQueryClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('useProfile', () => {
  beforeEach(() => {
    repo.getProfile.mockReset();
  });

  it('does not call the repo when there is no uid', async () => {
    const { wrapper } = withQueryClient();
    const { result } = renderHook(() => useProfile(undefined), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(repo.getProfile).not.toHaveBeenCalled();
    expect(result.current.data).toBe(null);
  });

  it('fetches the profile for the given uid', async () => {
    repo.getProfile.mockResolvedValue({ uid: 'u1', name: 'Test' });
    const { wrapper } = withQueryClient();
    const { result } = renderHook(() => useProfile('u1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ uid: 'u1', name: 'Test' }));
    expect(repo.getProfile).toHaveBeenCalledWith('u1');
    expect(result.current.error).toBe(null);
  });

  // The old bus-subscribing useAsync refetched every mounted hook itself; that
  // responsibility now lives in main.tsx's bus -> queryClient.invalidateQueries()
  // bridge (untested here, same reasoning as the rest of main.tsx — see vite.config.js
  // coverage excludes). What this hook itself must still guarantee is that an
  // invalidated query actually refetches and the component sees fresh data.
  it('refetches when the query cache is invalidated', async () => {
    repo.getProfile.mockResolvedValue({ uid: 'u1', name: 'First' });
    const { wrapper, queryClient } = withQueryClient();
    const { result } = renderHook(() => useProfile('u1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ uid: 'u1', name: 'First' }));

    repo.getProfile.mockResolvedValue({ uid: 'u1', name: 'Second' });
    await act(async () => { await queryClient.invalidateQueries(); });
    await waitFor(() => expect(result.current.data).toEqual({ uid: 'u1', name: 'Second' }));
    expect(repo.getProfile).toHaveBeenCalledTimes(2);
  });

  it('refetches when reload() is called (RetryCard onRetry)', async () => {
    repo.getProfile.mockResolvedValue({ uid: 'u1', name: 'First' });
    const { wrapper } = withQueryClient();
    const { result } = renderHook(() => useProfile('u1'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ uid: 'u1', name: 'First' }));

    repo.getProfile.mockResolvedValue({ uid: 'u1', name: 'Reloaded' });
    await act(async () => { result.current.reload(); });
    await waitFor(() => expect(result.current.data).toEqual({ uid: 'u1', name: 'Reloaded' }));
  });
});
