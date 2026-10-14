// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRAG_CLICK_WINDOW_MS, rowDropIndex, useRowReorderDrag } from './useRowReorderDrag';

afterEach(() => vi.restoreAllMocks());

// Where a dragged row lands (the Slide Deck and Contents lists).
describe('rowDropIndex', () => {
  it('moves up before a row and down after one', () => {
    expect(rowDropIndex(3, { index: 0, side: 'before' }, 5)).toBe(0);
    expect(rowDropIndex(0, { index: 3, side: 'after' }, 5)).toBe(3);
    expect(rowDropIndex(0, { index: 3, side: 'before' }, 5)).toBe(2);
  });

  it('is no move onto itself or its neighbours’ facing sides', () => {
    expect(rowDropIndex(2, { index: 2, side: 'before' }, 5)).toBeNull();
    expect(rowDropIndex(2, { index: 1, side: 'after' }, 5)).toBeNull();
    expect(rowDropIndex(-1, { index: 1, side: 'after' }, 5)).toBeNull();
  });

  it('clamps past the end', () => {
    expect(rowDropIndex(0, { index: 9, side: 'after' }, 5)).toBe(4);
  });
});

describe('useRowReorderDrag: the click a drag leaves', () => {
  const press = (x: number, y: number) =>
    ({
      button: 0,
      clientX: x,
      clientY: y,
      pointerId: 1,
      currentTarget: { setPointerCapture() {}, hasPointerCapture: () => false },
    }) as unknown as React.PointerEvent;

  function drag(now: { t: number }) {
    vi.spyOn(performance, 'now').mockImplementation(() => now.t);
    // jsdom has no hit-testing: the pointer is over no row.
    document.elementFromPoint = () => null;
    const { result } = renderHook(() =>
      useRowReorderDrag({ slot: 'row-slot', count: 3, onDrop: () => {} }),
    );
    act(() => result.current.beginDrag(press(0, 0), 'a'));
    act(() => result.current.moveDrag(press(0, 40)));
    act(() => result.current.endDrag(press(0, 40)));
    return result;
  }

  it('takes the click that follows a release as the drag’s own', () => {
    const now = { t: 1000 };
    const r = drag(now);
    now.t += 5;
    expect(r.current.consumeDragClick()).toBe(true);
    expect(r.current.consumeDragClick()).toBe(false);
  });

  it('lets the next tap through after a touch drag that sent no click', () => {
    const now = { t: 1000 };
    const r = drag(now);
    now.t += DRAG_CLICK_WINDOW_MS + 600;
    expect(r.current.consumeDragClick()).toBe(false);
  });
});
