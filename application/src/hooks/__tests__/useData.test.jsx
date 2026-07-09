import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Replace the whole data layer so no Firestore/Firebase is touched. The fake
// bus notifies subscribers synchronously, which is enough to prove refetch.
vi.mock('../../data/repo.js', () => {
  const listeners = new Set();
  return {
    repo: { getProfile: vi.fn() },
    bus: {
      subscribe: (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      emit: () => listeners.forEach((fn) => fn()),
    },
  };
});

import { useProfile } from '../useData.js';
import { repo, bus } from '../../data/repo.js';

describe('useProfile', () => {
  beforeEach(() => {
    repo.getProfile.mockReset();
  });

  it('does not call the repo when there is no uid', async () => {
    const { result } = renderHook(() => useProfile(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(repo.getProfile).not.toHaveBeenCalled();
    expect(result.current.data).toBe(null);
  });

  it('fetches the profile for the given uid', async () => {
    repo.getProfile.mockResolvedValue({ uid: 'u1', name: 'Test' });
    const { result } = renderHook(() => useProfile('u1'));
    await waitFor(() => expect(result.current.data).toEqual({ uid: 'u1', name: 'Test' }));
    expect(repo.getProfile).toHaveBeenCalledWith('u1');
    expect(result.current.error).toBe(null);
  });

  it('refetches when the change bus emits', async () => {
    repo.getProfile.mockResolvedValue({ uid: 'u1', name: 'First' });
    const { result } = renderHook(() => useProfile('u1'));
    await waitFor(() => expect(result.current.data).toEqual({ uid: 'u1', name: 'First' }));

    repo.getProfile.mockResolvedValue({ uid: 'u1', name: 'Second' });
    act(() => {
      bus.emit();
    });
    await waitFor(() => expect(result.current.data).toEqual({ uid: 'u1', name: 'Second' }));
    expect(repo.getProfile).toHaveBeenCalledTimes(2);
  });
});
