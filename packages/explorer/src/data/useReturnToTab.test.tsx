// @vitest-environment jsdom
// Coming back to the tab (useReturnToTab.ts): useReturnCount counts each return while enabled, one per gap, never
// while the page is hidden (Work Tracker 1460, 1461).
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RETURN_REREAD_GAP_MS, useReturnCount } from './useReturnToTab';
import { comeBackToPage, leaveReturnClock } from './return-to-tab-testing';

afterEach(() => {
  leaveReturnClock();
  delete (document as { visibilityState?: unknown }).visibilityState;
});

describe('useReturnCount', () => {
  it('counts each return to the page, folding its focus into the same one', () => {
    const { result } = renderHook(() => useReturnCount());
    expect(result.current).toBe(0);
    act(() => comeBackToPage());
    expect(result.current).toBe(1);
    // The same return's focus, inside the gap.
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current).toBe(1);
    act(() => comeBackToPage());
    expect(result.current).toBe(2);
  });

  it('counts nothing while not enabled, or while the page is hidden', () => {
    const { result, rerender } = renderHook(({ on }) => useReturnCount(on), {
      initialProps: { on: false },
    });
    act(() => comeBackToPage());
    expect(result.current).toBe(0);
    rerender({ on: true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => comeBackToPage());
    expect(result.current).toBe(0);
    delete (document as { visibilityState?: unknown }).visibilityState;
    act(() => comeBackToPage());
    expect(result.current).toBe(1);
  });

  it('reads again within two seconds of a return, short enough for a rename and straight back', () => {
    expect(RETURN_REREAD_GAP_MS).toBeLessThanOrEqual(2_000);
  });
});
