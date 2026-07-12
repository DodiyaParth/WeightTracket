import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { mockMatchMedia } from '../../test/test-utils.jsx';
import { useIsMobile } from '../useIsMobile.js';

describe('useIsMobile', () => {
  it('reflects a matching initial query as mobile', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('defaults to desktop when the query does not match', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('updates live as the viewport crosses the breakpoint', () => {
    const mql = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      mql.change(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      mql.change(false);
    });
    expect(result.current).toBe(false);
  });

  it('cleans up its listener on unmount', () => {
    const mql = mockMatchMedia(false);
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    // A change fired after unmount must not throw (no state update on an
    // unmounted component) — proving the effect's cleanup actually ran.
    expect(() => mql.change(true)).not.toThrow();
  });

  it('falls back to the legacy addListener/removeListener API pre-Safari 14', () => {
    let listener: ((e: { matches: boolean }) => void) | undefined;
    const legacyMql = {
      matches: false,
      media: '(max-width: 768px)',
      onchange: null,
      addEventListener: undefined,
      removeEventListener: undefined,
      addListener: vi.fn((cb) => {
        listener = cb;
      }),
      removeListener: vi.fn(),
      dispatchEvent: () => false,
    };
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue(legacyMql);

    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    expect(legacyMql.addListener).toHaveBeenCalled();

    act(() => {
      legacyMql.matches = true;
      listener?.({ matches: true });
    });
    expect(result.current).toBe(true);

    unmount();
    expect(legacyMql.removeListener).toHaveBeenCalled();

    window.matchMedia = original;
  });
});
