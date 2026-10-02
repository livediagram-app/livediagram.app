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
    const { result } = renderHook(() => useCanvasClientOrigin(ref, false, 'v'));
    expect(result.current).toBeNull();
    expect(measure).not.toHaveBeenCalled();
  });

  it('has the wrapper origin on the first render that shows it', () => {
    const { ref } = wrapperAt({ left: 10, top: 20 });
    const { result } = renderHook(() => useCanvasClientOrigin(ref, true, 'v'));
    expect(result.current).toEqual({ left: 10, top: 20 });
  });

  it('follows the wrapper when the view moves', () => {
    const w = wrapperAt({ left: 10, top: 20 });
    const { result, rerender } = renderHook(
      ({ view }) => useCanvasClientOrigin(w.ref, true, view),
      {
        initialProps: { view: '0,0,1' },
      },
    );
    w.at.left = 50;
    w.at.top = -5;
    rerender({ view: '40,-25,1' });
    expect(result.current).toEqual({ left: 50, top: -5 });
  });

  // docs/specs/008-canvas/canvas-performance.md: a gesture frame never reads layout. The origin moves
  // only with the view, so renders that keep the view (every frame of a drag) measure nothing.
  it('measures once while the view stays put, however often it renders', () => {
    const w = wrapperAt({ left: 10, top: 20 });
    const { rerender } = renderHook(() => useCanvasClientOrigin(w.ref, true, '0,0,1'));
    const once = w.measure.mock.calls.length;
    for (let i = 0; i < 30; i++) rerender();
    expect(w.measure.mock.calls.length).toBe(once);
  });

  it('keeps the same origin object while the wrapper stays put', () => {
    const { ref } = wrapperAt({ left: 10, top: 20 });
    const { result, rerender } = renderHook(() => useCanvasClientOrigin(ref, true, 'v'));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('is null when there is no wrapper to measure', () => {
    const { result } = renderHook(() => useCanvasClientOrigin({ current: null }, true, 'v'));
    expect(result.current).toBeNull();
  });

  it('drops back to null when deactivated', () => {
    const { ref } = wrapperAt({ left: 10, top: 20 });
    const { result, rerender } = renderHook(({ on }) => useCanvasClientOrigin(ref, on, 'v'), {
      initialProps: { on: true },
    });
    rerender({ on: false });
    expect(result.current).toBeNull();
  });
});
