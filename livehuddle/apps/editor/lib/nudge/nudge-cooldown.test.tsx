// @vitest-environment jsdom

// The cooling button's clock (docs/specs/012-collaboration/nudge.md "Nudging"): it reads the time left, wakes on the
// next whole second while it runs, and stops once the 2 minutes are over.
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NUDGE_COOLDOWN_MS } from '@livehuddle/api-schema';
import {
  holdNudgeCooldown,
  resetNudges,
  sendNudge,
  setNudgeSender,
  useNudgeCooldown,
} from './nudge-inbox';

const sam = { id: 's1', key: 'k-sam', name: 'Sam' };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  resetNudges();
});
afterEach(() => {
  resetNudges();
  vi.useRealTimers();
});

describe('useNudgeCooldown', () => {
  it('reads 0 for someone not nudged, with no clock running', () => {
    const before = vi.getTimerCount();
    const { result } = renderHook(() => useNudgeCooldown(sam));
    expect(result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(before);
  });

  it('counts down from a send, a second at a time, and stops at 0', () => {
    setNudgeSender(() => {});
    const { result, unmount } = renderHook(() => useNudgeCooldown(sam));
    act(() => {
      sendNudge(sam);
    });
    expect(result.current).toBe(NUDGE_COOLDOWN_MS);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(NUDGE_COOLDOWN_MS - 1_000);
    act(() => {
      vi.advanceTimersByTime(NUDGE_COOLDOWN_MS);
    });
    expect(result.current).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    unmount();
  });

  it('wakes on the next whole second after a part-second refusal, and starts a clock when mounted cooling', () => {
    holdNudgeCooldown(sam, 1_500);
    const { result, unmount } = renderHook(() => useNudgeCooldown(sam));
    expect(result.current).toBe(1_500);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(1_000);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
