// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AWAY_AFTER_MS } from '@/lib/identity';
import { RELATIVE_TICK_MS } from '@/lib/relative-time';
import { usePresenceState } from './usePresenceState';

// Presence statuses render from a snapshot, never from a ref read during render
// (docs/specs/003-system-architecture/react-state-and-effects.md). The ref still takes every cursor-packet
// bump without re-rendering; the snapshot moves on the idle tick, and at once when a peer arrives or
// comes back from idle, so a returning peer flips to online immediately.
const T0 = Date.parse('2026-09-28T10:00:00Z');
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

describe('usePresenceState presence clock', () => {
  it('publishes a peer at once when first seen', () => {
    const { result } = renderHook(() => usePresenceState());
    act(() => result.current.markSeen('p1'));
    expect(result.current.presenceClock.lastSeen.get('p1')).toBe(T0);
  });

  it('takes frequent bumps without re-rendering, until the tick', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return usePresenceState();
    });
    act(() => result.current.markSeen('p1'));
    const after = renders;
    act(() => {
      vi.advanceTimersByTime(1000);
      result.current.markSeen('p1');
      vi.advanceTimersByTime(1000);
      result.current.markSeen('p1');
    });
    expect(renders).toBe(after);
    expect(result.current.presenceClock.lastSeen.get('p1')).toBe(T0);
    act(() => vi.advanceTimersByTime(RELATIVE_TICK_MS));
    expect(result.current.presenceClock.lastSeen.get('p1')).toBe(T0 + 2000);
    // The tick keeps its own schedule, from mount.
    expect(result.current.presenceClock.now).toBe(T0 + RELATIVE_TICK_MS);
  });

  it('publishes a peer back from idle at once', () => {
    const { result } = renderHook(() => usePresenceState());
    act(() => result.current.markSeen('p1'));
    act(() => vi.advanceTimersByTime(AWAY_AFTER_MS + 1000));
    act(() => result.current.markSeen('p1'));
    expect(result.current.presenceClock.lastSeen.get('p1')).toBe(T0 + AWAY_AFTER_MS + 1000);
    expect(result.current.presenceClock.now).toBe(T0 + AWAY_AFTER_MS + 1000);
  });
});
