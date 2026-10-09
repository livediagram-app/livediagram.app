// @vitest-environment jsdom
// Panning a Sheet's cells by hand (docs/specs/029-sheets/sheet.md "Panning").
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAN_START_PX, useSheetPan } from './useSheetPan';

function scroller(tool?: string) {
  const host = document.createElement('main');
  if (tool) host.dataset.canvasTool = tool;
  const el = document.createElement('div');
  host.appendChild(el);
  document.body.appendChild(host);
  const at = { left: 100, top: 100 };
  Object.defineProperty(el, 'scrollLeft', {
    get: () => at.left,
    set: (v: number) => (at.left = v),
  });
  Object.defineProperty(el, 'scrollTop', { get: () => at.top, set: (v: number) => (at.top = v) });
  return { el, at };
}

const press = (init: {
  button?: number;
  pointerType?: string;
  pointerId?: number;
  x?: number;
  y?: number;
}) =>
  ({
    button: init.button ?? 0,
    pointerType: init.pointerType ?? 'mouse',
    pointerId: init.pointerId ?? 1,
    clientX: init.x ?? 0,
    clientY: init.y ?? 0,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
  }) as unknown as React.PointerEvent;

const move = (x: number, y: number, pointerId = 1) =>
  act(() => {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerId }));
  });
const release = (pointerId = 1) =>
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId }));
  });
const key = (key: string, extra: Record<string, unknown> = {}) =>
  ({
    key,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    preventDefault: vi.fn(),
    ...extra,
  }) as unknown as React.KeyboardEvent;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('panning a Sheet', () => {
  it('pans with the middle button, against the drag', () => {
    const { el, at } = scroller();
    const { result } = renderHook(() => useSheetPan(() => el));
    expect(result.current.begin(press({ button: 1 }), { maximised: false })).toBe(true);
    move(30, 20);
    expect(at).toEqual({ left: 70, top: 80 });
    release();
    move(60, 60);
    expect(at).toEqual({ left: 70, top: 80 });
  });

  it('leaves a plain left press to the selection, even under the Hand tool, and pans one with Space held', () => {
    const { el } = scroller();
    const { result } = renderHook(() => useSheetPan(() => el));
    expect(result.current.begin(press({ button: 0 }), { maximised: false })).toBe(false);
    expect(result.current.onKeyDown(key(' '))).toBe(true);
    expect(result.current.begin(press({ button: 0 }), { maximised: false })).toBe(true);
    move(10, 0);
    release();
    // The Space was used to pan: it types nothing.
    const typed = vi.fn();
    result.current.onKeyUp(key(' '), typed);
    expect(typed).not.toHaveBeenCalled();
    // A Space without a pan types a space; Shift+Space is not taken.
    result.current.onKeyDown(key(' '));
    result.current.onKeyUp(key(' '), typed);
    expect(typed).toHaveBeenCalledTimes(1);
    expect(result.current.onKeyDown(key(' ', { shiftKey: true }))).toBe(false);
    // Focus moved while Space was held: it is let go, so a left press selects again.
    result.current.onKeyDown(key(' '));
    result.current.releaseSpace();
    expect(result.current.begin(press({ button: 0 }), { maximised: false })).toBe(false);
    // The canvas's Hand tool (Plan mode's own) leaves a plain left press to the cells.
    const hand = scroller('pan');
    const { result: r2 } = renderHook(() => useSheetPan(() => hand.el));
    expect(r2.current.begin(press({ button: 0 }), { maximised: false })).toBe(false);
  });

  it('pans with the right button once it moves, and holds the menu for a right press that does not', () => {
    const { el, at } = scroller();
    const { result } = renderHook(() => useSheetPan(() => el));
    const open = vi.fn();
    result.current.begin(press({ button: 2 }), { maximised: false });
    expect(result.current.rightPending()).toBe(true);
    result.current.afterRightClick(open);
    move(PAN_START_PX - 1, 0);
    release();
    expect(open).toHaveBeenCalledTimes(1);
    expect(at.left).toBe(100);
    // Dragged: it pans, and the menu that follows is swallowed.
    result.current.begin(press({ button: 2 }), { maximised: false });
    result.current.afterRightClick(open);
    move(40, 0);
    release();
    expect(at.left).toBe(60);
    expect(open).toHaveBeenCalledTimes(1);
    expect(result.current.swallowContextMenu()).toBe(true);
  });

  it('pans under one finger, a tap stays a tap, a second finger hands over, and a maximised grid scrolls itself', () => {
    const { el, at } = scroller();
    const { result } = renderHook(() => useSheetPan(() => el));
    expect(result.current.begin(press({ pointerType: 'touch' }), { maximised: false })).toBe(true);
    release();
    expect(result.current.swallowClick()).toBe(false);
    result.current.begin(press({ pointerType: 'touch' }), { maximised: false });
    move(0, 50);
    expect(at.top).toBe(50);
    // Taken (so it starts no selection), and the pan ends.
    expect(
      result.current.begin(press({ pointerType: 'touch', pointerId: 2 }), { maximised: false }),
    ).toBe(true);
    move(0, 90);
    expect(at.top).toBe(50);
    expect(result.current.begin(press({ pointerType: 'touch' }), { maximised: true })).toBe(false);
  });
});
