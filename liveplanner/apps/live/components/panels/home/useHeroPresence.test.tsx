// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOTION_MS } from '@liveplanner/tailwind-config/motion';
import { useHeroPresence } from './useHeroPresence';

// docs/specs/013-workspace/explorer-home.md "The hero": it comes and goes with Home, folding away over the `long`
// token and unfolding on return; landing on Home shows it at once.

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const frames = () =>
  act(() => {
    vi.advanceTimersToNextFrame();
    vi.advanceTimersToNextFrame();
  });

describe('useHeroPresence', () => {
  it('shows at once when the Explorer lands on Home', () => {
    const { result } = renderHook(() => useHeroPresence(true));
    expect(result.current).toEqual({ mounted: true, open: true });
  });

  it('is not in the page on another view', () => {
    const { result } = renderHook(() => useHeroPresence(false));
    expect(result.current).toEqual({ mounted: false, open: false });
  });

  it('folds away on leaving Home, then leaves the page once the fold is done', () => {
    const { result, rerender } = renderHook(({ home }) => useHeroPresence(home), {
      initialProps: { home: true },
    });
    rerender({ home: false });
    expect(result.current).toEqual({ mounted: true, open: false });
    act(() => {
      vi.advanceTimersByTime(MOTION_MS.long - 1);
    });
    expect(result.current.mounted).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toEqual({ mounted: false, open: false });
  });

  it('mounts folded on returning to Home, then unfolds on the next frames', () => {
    const { result, rerender } = renderHook(({ home }) => useHeroPresence(home), {
      initialProps: { home: false },
    });
    rerender({ home: true });
    expect(result.current).toEqual({ mounted: true, open: false });
    frames();
    expect(result.current).toEqual({ mounted: true, open: true });
  });

  it('unfolds again when the reader comes back before the fold finished', () => {
    const { result, rerender } = renderHook(({ home }) => useHeroPresence(home), {
      initialProps: { home: true },
    });
    rerender({ home: false });
    act(() => {
      vi.advanceTimersByTime(MOTION_MS.long / 2);
    });
    rerender({ home: true });
    frames();
    act(() => {
      vi.advanceTimersByTime(MOTION_MS.long);
    });
    expect(result.current).toEqual({ mounted: true, open: true });
  });
});
