// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createViewportStore } from '@/lib/viewport-store';
import { useStoreSlice } from './useStoreSlice';

// docs/specs/008-canvas/blueprints/viewport-store.md: a reader renders only when its slice changes.

describe('useStoreSlice', () => {
  it('renders only when the selected slice changes', () => {
    const store = createViewportStore(1);
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useStoreSlice(store, (v) => v.zoom);
    });
    const before = renders;

    act(() => store.setOffset({ x: 10, y: 0 }));
    expect(renders).toBe(before);
    act(() => store.setZoom(2));

    expect(result.current).toBe(2);
    expect(renders).toBe(before + 1);
  });

  it('keeps an equal slice by the given comparison', () => {
    const store = createViewportStore(1);
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useStoreSlice(
        store,
        (v) => ({ big: v.zoom > 1 }),
        (a, b) => a.big === b.big,
      );
    });
    const before = renders;
    act(() => store.setZoom(0.5));
    expect(renders).toBe(before);
  });

  it('selects again when the selector changes', () => {
    const store = createViewportStore(2);
    const { result, rerender } = renderHook(({ k }) => useStoreSlice(store, (v) => v.zoom * k), {
      initialProps: { k: 1 },
    });
    rerender({ k: 3 });
    expect(result.current).toBe(6);
  });
});
