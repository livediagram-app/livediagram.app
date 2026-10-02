// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';
import { beginCanvasGesture, resetCanvasGesturesForTests } from '@/lib/canvas-gesture';
import { MAP_REDRAW_MIN_MS, useSettledElements } from './useSettledElements';

// docs/specs/008-canvas/canvas-performance.md: the Map redraws when a gesture ends, not on every
// frame of it; outside gestures a change shows at most once every MAP_REDRAW_MIN_MS.

const board = (n: number): Element[] =>
  Array.from({ length: n }, (_, i) => ({ id: `e${i}` }) as unknown as Element);

function setup() {
  return renderHook(({ elements }) => useSettledElements(elements), {
    initialProps: { elements: board(1) },
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  resetCanvasGesturesForTests();
});

describe('useSettledElements', () => {
  it('shows the elements it starts with', () => {
    const { result } = setup();
    expect(result.current).toHaveLength(1);
  });

  it('keeps its last drawing through an element gesture and catches up when it ends', () => {
    const { result, rerender } = setup();
    let end = () => {};
    act(() => {
      end = beginCanvasGesture('move');
    });
    for (let n = 2; n < 30; n++) rerender({ elements: board(n) });
    act(() => vi.advanceTimersByTime(MAP_REDRAW_MIN_MS * 4));
    expect(result.current).toHaveLength(1);
    act(() => end());
    expect(result.current).toHaveLength(29);
  });

  for (const kind of ['resize', 'reshape', 'stroke', 'erase'] as const) {
    it(`freezes through a ${kind} too`, () => {
      const { result, rerender } = setup();
      act(() => {
        beginCanvasGesture(kind);
      });
      rerender({ elements: board(5) });
      expect(result.current).toHaveLength(1);
    });
  }

  it('shows a change at once after a quiet spell', () => {
    const { result, rerender } = setup();
    act(() => vi.advanceTimersByTime(MAP_REDRAW_MIN_MS));
    rerender({ elements: board(2) });
    expect(result.current).toHaveLength(2);
  });

  it('holds a burst of changes to one trailing redraw', () => {
    const { result, rerender } = setup();
    act(() => vi.advanceTimersByTime(MAP_REDRAW_MIN_MS));
    rerender({ elements: board(2) });
    rerender({ elements: board(3) });
    rerender({ elements: board(4) });
    expect(result.current).toHaveLength(2);
    act(() => vi.advanceTimersByTime(MAP_REDRAW_MIN_MS - 1));
    expect(result.current).toHaveLength(2);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toHaveLength(4);
  });

  it('holds a trailing redraw that falls due mid-gesture until the gesture ends', () => {
    const { result, rerender } = setup();
    act(() => vi.advanceTimersByTime(MAP_REDRAW_MIN_MS));
    rerender({ elements: board(2) });
    rerender({ elements: board(3) });
    let end = () => {};
    act(() => {
      end = beginCanvasGesture('move');
    });
    rerender({ elements: board(4) });
    act(() => vi.advanceTimersByTime(MAP_REDRAW_MIN_MS * 2));
    expect(result.current).toHaveLength(2);
    act(() => end());
    expect(result.current).toHaveLength(4);
  });

  it('is not frozen by a pan, a zoom or a marquee', () => {
    const { result, rerender } = setup();
    act(() => {
      beginCanvasGesture('pan');
    });
    act(() => vi.advanceTimersByTime(MAP_REDRAW_MIN_MS));
    rerender({ elements: board(3) });
    expect(result.current).toHaveLength(3);
  });

  it('keeps the same array when nothing changed', () => {
    const elements = board(3);
    const { result, rerender } = renderHook(({ e }) => useSettledElements(e), {
      initialProps: { e: elements },
    });
    rerender({ e: elements });
    expect(result.current).toBe(elements);
  });
});
