import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAsyncAction } from '../useAsyncAction.js';

describe('useAsyncAction', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useAsyncAction());
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('is busy while the action runs and idle once it resolves', async () => {
    const { result } = renderHook(() => useAsyncAction());

    let resolveFn;
    const pending = new Promise((res) => {
      resolveFn = res;
    });

    let runPromise;
    act(() => {
      runPromise = result.current.run(() => pending);
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      resolveFn('ok');
      await runPromise;
    });
    expect(result.current.busy).toBe(false);
    await expect(runPromise).resolves.toBe('ok');
  });

  it('captures the error message, clears busy, and rethrows on failure', async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await expect(
        result.current.run(async () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
    });

    expect(result.current.error).toBe('boom');
    expect(result.current.busy).toBe(false);
  });

  it('lets callers clear the error via setError', async () => {
    const { result } = renderHook(() => useAsyncAction());

    await act(async () => {
      await result.current
        .run(async () => {
          throw new Error('nope');
        })
        .catch(() => {});
    });
    expect(result.current.error).toBe('nope');

    act(() => {
      result.current.setError(null);
    });
    expect(result.current.error).toBe(null);
  });
});
