// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useQuickRing } from './useQuickRing';

// One quick-connect ring opens at a time, and a new selection closes it.
describe('useQuickRing', () => {
  it('closes the ring when the selection changes, and keeps it over the same one', () => {
    const { result, rerender } = renderHook(({ id }) => useQuickRing(id), {
      initialProps: { id: 'a' as string | null },
    });
    act(() => result.current[1]('right'));
    rerender({ id: 'a' });
    expect(result.current[0]).toBe('right');
    rerender({ id: 'b' });
    expect(result.current[0]).toBeNull();
  });

  it('closes on a press outside any ring', () => {
    const { result } = renderHook(() => useQuickRing('a'));
    act(() => result.current[1]('below'));
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(result.current[0]).toBeNull();
  });
});
