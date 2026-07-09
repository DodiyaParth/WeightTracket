import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bus } from '../bus.js';

// emit() is debounced by ~30ms and coalesces bursts into a single notify.
describe('bus', () => {
  let offs = [];
  const track = (cb) => {
    const off = bus.subscribe(cb);
    offs.push(off);
    return off;
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    offs.forEach((off) => off());
    offs = [];
    vi.useRealTimers();
  });

  it('notifies subscribers after the debounce window', () => {
    const cb = vi.fn();
    track(cb);
    bus.emit();
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('coalesces a burst of emits into a single notification', () => {
    const cb = vi.fn();
    track(cb);
    bus.emit();
    bus.emit();
    bus.emit();
    vi.advanceTimersByTime(30);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const cb = vi.fn();
    const off = bus.subscribe(cb);
    off();
    bus.emit();
    vi.advanceTimersByTime(30);
    expect(cb).not.toHaveBeenCalled();
  });

  it('isolates a throwing subscriber from the others', () => {
    const bad = vi.fn(() => {
      throw new Error('listener blew up');
    });
    const good = vi.fn();
    track(bad);
    track(good);
    bus.emit();
    vi.advanceTimersByTime(30);
    expect(good).toHaveBeenCalledTimes(1);
  });
});
