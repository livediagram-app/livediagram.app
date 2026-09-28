// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCanvasClientOrigin } from './useCanvasClientOrigin';

function wrapperAt(at: { left: number; top: number }) {
  const el = document.createElement('div');
  const measure = vi.fn(() => ({ ...at, width: 100, height: 100 }) as DOMRect);
  el.getBoundingClientRect = measure;
  return { ref: { current: el }, at, measure };
}

describe('useCanvasClientOrigin', () => {
  it('is null and measures nothing while inactive', () => {
    const { ref, measure } = wrapperAt({ left: 10, top: 20 });
    const { result } = renderHook(() => useCanvasClientOrigin(ref, false));
    expect(result.current).toBeNull();
    expect(measure).not.toHaveBeenCalled();
  });

  it('has the wrapper origin on the first render that shows it', () => {
    const { ref } = wrapperAt({ left: 10, top: 20 });
    const { result } = renderHook(() => useCanvasClientOrigin(ref, true));
    expect(result.current).toEqual({ left: 10, top: 20 });
  });

  it('follows the wrapper when it moves between renders', () => {
    const w = wrapperAt({ left: 10, top: 20 });
    const { result, rerender } = renderHook(() => useCanvasClientOrigin(w.ref, true));
    w.at.left = 50;
    w.at.top = -5;
    rerender();
    expect(result.current).toEqual({ left: 50, top: -5 });
  });

  it('keeps the same origin object while the wrapper stays put', () => {
    const { ref } = wrapperAt({ left: 10, top: 20 });
    const { result, rerender } = renderHook(() => useCanvasClientOrigin(ref, true));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('is null when there is no wrapper to measure', () => {
    const { result } = renderHook(() => useCanvasClientOrigin({ current: null }, true));
    expect(result.current).toBeNull();
  });

  it('drops back to null when deactivated', () => {
    const { ref } = wrapperAt({ left: 10, top: 20 });
    const { result, rerender } = renderHook(({ on }) => useCanvasClientOrigin(ref, on), {
      initialProps: { on: true },
    });
    rerender({ on: false });
    expect(result.current).toBeNull();
  });
});
