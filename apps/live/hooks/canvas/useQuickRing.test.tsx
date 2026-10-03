// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createSelectionStore } from '@/lib/selection-store';
import { useQuickRing } from './useQuickRing';

// One quick-connect ring opens at a time, and a new selection closes it.
describe('useQuickRing', () => {
  it('closes the ring when the selection changes, and keeps it over the same one', () => {
    const store = createSelectionStore();
    store.setSelectedId('a');
    const { result } = renderHook(() => useQuickRing(store));
    act(() => result.current[1]('right'));

    act(() => store.setMultiSelectedIds(new Set()));
    expect(result.current[0]).toBe('right');
    act(() => store.setSelectedId('b'));

    expect(result.current[0]).toBeNull();
  });

  it('does not re-render for a selection change while the ring is closed', () => {
    const store = createSelectionStore();
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useQuickRing(store);
    });
    const before = renders;

    act(() => store.setSelectedId('a'));
    act(() => store.setSelectedId('b'));

    expect(renders).toBe(before);
  });

  it('closes on a press outside any ring', () => {
    const store = createSelectionStore();
    const { result } = renderHook(() => useQuickRing(store));
    act(() => result.current[1]('below'));
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    expect(result.current[0]).toBeNull();
  });
});
