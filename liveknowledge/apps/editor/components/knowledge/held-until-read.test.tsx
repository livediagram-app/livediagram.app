// @vitest-environment jsdom
// Page Health's score through a page switch (docs/specs/030-knowledgebase/page-surface.md "Switching pages"): held
// on the score before until the new page's own read is here, for at most RAIL_HOLD_MAX_MS.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHeldUntilRead } from './held-until-read';
import { RAIL_HOLD_MAX_MS } from './loaded-page-store';

type Props = { value: number; read: boolean; page: string };
const hold = (initial: Props) =>
  renderHook((p: Props) => useHeldUntilRead(p.value, p.read, p.page), { initialProps: initial });

afterEach(() => {
  vi.useRealTimers();
});

describe('useHeldUntilRead', () => {
  it('follows a page whose read is here', () => {
    const h = hold({ value: 42, read: true, page: 'a' });
    expect(h.result.current).toBe(42);
    h.rerender({ value: 40, read: true, page: 'a' });
    expect(h.result.current).toBe(40);
  });

  it('keeps the score before while the new page’s read is on its way, then changes once', () => {
    const h = hold({ value: 42, read: true, page: 'a' });
    h.rerender({ value: 43, read: false, page: 'b' });
    expect(h.result.current).toBe(42);
    h.rerender({ value: 41, read: true, page: 'b' });
    expect(h.result.current).toBe(41);
  });

  it('lets go after the cap when the read never lands', () => {
    vi.useFakeTimers();
    const h = hold({ value: 42, read: true, page: 'a' });
    h.rerender({ value: 43, read: false, page: 'b' });
    act(() => {
      vi.advanceTimersByTime(RAIL_HOLD_MAX_MS - 1);
    });
    expect(h.result.current).toBe(42);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(h.result.current).toBe(43);
  });

  it('holds again on the next page after a cap ran out on the one before', () => {
    vi.useFakeTimers();
    const h = hold({ value: 42, read: true, page: 'a' });
    h.rerender({ value: 43, read: false, page: 'b' });
    act(() => {
      vi.advanceTimersByTime(RAIL_HOLD_MAX_MS);
    });
    h.rerender({ value: 39, read: false, page: 'c' });
    expect(h.result.current).toBe(43);
  });
});
