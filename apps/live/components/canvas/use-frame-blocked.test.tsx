// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFrameBlocked } from './use-frame-blocked';

// A frame that never loads is called dead (docs/specs/009-elements/website-embed.md); a new URL asks afresh.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('useFrameBlocked', () => {
  it('calls a frame dead when it never loads', () => {
    const { result } = renderHook(() => useFrameBlocked('https://a.example'));
    wait(8000);
    expect(result.current.failed).toBe(true);
  });

  it('settles on any load event', () => {
    const { result } = renderHook(() => useFrameBlocked('https://a.example'));
    act(() => result.current.onLoad());
    wait(8000);
    expect(result.current.failed).toBe(false);
  });

  it('forgets the verdict when the URL changes, and asks again', () => {
    const { result, rerender } = renderHook(({ src }) => useFrameBlocked(src), {
      initialProps: { src: 'https://a.example' as string | undefined },
    });
    wait(8000);
    rerender({ src: 'https://b.example' });
    expect(result.current.failed).toBe(false);
    wait(8000);
    expect(result.current.failed).toBe(true);
  });

  it('asks nothing without a URL', () => {
    const { result } = renderHook(() => useFrameBlocked(undefined));
    wait(8000);
    expect(result.current.failed).toBe(false);
  });
});
