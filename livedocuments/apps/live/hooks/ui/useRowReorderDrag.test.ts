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
  // jsdom has no hit-testing. Each test says what is under the pointer, and the original is put back, so nothing
  // leaks to a later test.
  const original = document.elementFromPoint;
  afterEach(() => {
    document.elementFromPoint = original;
  });
  const row = () => {
    const el = document.createElement('div');
    el.setAttribute('data-row-slot', '1');
    el.getBoundingClientRect = () =>
      ({ top: 0, height: 40, bottom: 40, left: 0, right: 100, width: 100 }) as DOMRect;
    return el;
  };
  const press = (x: number, y: number, timeStamp = 0, type = 'pointerup') =>
    ({
      type,
      timeStamp,
      button: 0,
      clientX: x,
      clientY: y,
      pointerId: 1,
      currentTarget: { setPointerCapture() {}, hasPointerCapture: () => false },
    }) as unknown as React.PointerEvent;

  function drag(endAt: number, opts: { over?: Element | null; type?: string } = {}) {
    const over = opts.over ?? null;
    document.elementFromPoint = () => over;
    const onDrop = vi.fn();
    const { result } = renderHook(() => useRowReorderDrag({ slot: 'row-slot', count: 3, onDrop }));
    act(() => result.current.beginDrag(press(0, 0), 'a'));
    act(() => result.current.moveDrag(press(0, 30)));
    act(() => result.current.endDrag(press(0, 30, endAt, opts.type)));
    return { r: result, onDrop };
  }

  it('takes the click that follows a release as the drag’s own', () => {
    const { r } = drag(1000);
    expect(r.current.consumeDragClick(1005)).toBe(true);
    expect(r.current.consumeDragClick(1006)).toBe(false);
  });

  // The window is between the two events' own times, so a slow re-render of the drop never lets its click through.
  it('takes the release’s click whatever time the drop’s re-render took', () => {
    const { r } = drag(1000);
    vi.spyOn(performance, 'now').mockReturnValue(1000 + DRAG_CLICK_WINDOW_MS + 400);
    expect(r.current.consumeDragClick(1003)).toBe(true);
  });

  it('lets the next tap through after a touch drag that sent no click', () => {
    const { r } = drag(1000);
    expect(r.current.consumeDragClick(1000 + DRAG_CLICK_WINDOW_MS + 600)).toBe(false);
  });

  it('drops on release over a row, and never on a cancelled pointer', () => {
    expect(drag(1000, { over: row() }).onDrop).toHaveBeenCalledTimes(1);
    expect(drag(1000, { over: row(), type: 'pointercancel' }).onDrop).not.toHaveBeenCalled();
  });
});
