// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCopiedFlash } from './useCopiedFlash';

describe('useCopiedFlash', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flashes then resets after the delay', () => {
    const { result } = renderHook(() => useCopiedFlash(1000));
    expect(result.current.copied).toBeNull();
    act(() => result.current.flash());
    expect(result.current.copied).toBe(true);
    act(() => void vi.advanceTimersByTime(999));
    expect(result.current.copied).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.copied).toBeNull();
  });

  it('restarts the countdown on a repeat flash and keeps the flashed value', () => {
    const { result } = renderHook(() => useCopiedFlash<string>(1000));
    act(() => result.current.flash('a'));
    act(() => void vi.advanceTimersByTime(800));
    act(() => result.current.flash('b'));
    act(() => void vi.advanceTimersByTime(800));
    expect(result.current.copied).toBe('b');
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current.copied).toBeNull();
  });

  it('reset clears at once', () => {
    const { result } = renderHook(() => useCopiedFlash(1000));
    act(() => result.current.flash());
    act(() => result.current.reset());
    expect(result.current.copied).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the pending timer on unmount', () => {
    const { result, unmount } = renderHook(() => useCopiedFlash(1000));
    act(() => result.current.flash());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
