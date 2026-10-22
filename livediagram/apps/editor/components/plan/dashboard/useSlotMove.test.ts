// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Moving a slot": Escape, a cancelled pointer, or the page going away puts the slot
// back, with nothing moved and no listener left behind.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSlotMove } from './useSlotMove';

afterEach(() => vi.restoreAllMocks());

function setup() {
  const page = document.createElement('div');
  const onMove = vi.fn();
  const hook = renderHook(() =>
    useSlotMove({ pageRef: { current: page }, allowMove: () => () => true, onMove }),
  );
  act(() => hook.result.current.beginMove('s', { clientX: 10, clientY: 10 }));
  return { ...hook, onMove };
}

const pointer = (type: string) => {
  const e = new Event(type) as Event & { clientX: number; clientY: number };
  Object.assign(e, { clientX: 20, clientY: 20 });
  return e;
};

describe('a slot carried by its grip', () => {
  it('moves where it is let go', () => {
    const { result, onMove } = setup();
    expect(result.current.moving?.slotId).toBe('s');
    act(() => {
      window.dispatchEvent(pointer('pointerup'));
    });
    expect(onMove).toHaveBeenCalledWith('s', { kind: 'row-gap', index: 0 });
    expect(result.current.moving).toBeNull();
  });

  it('goes back when the pointer is cancelled, and a later tap moves nothing', () => {
    const { result, onMove } = setup();
    act(() => {
      window.dispatchEvent(pointer('pointercancel'));
    });
    expect(result.current.moving).toBeNull();
    act(() => {
      window.dispatchEvent(pointer('pointerup'));
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('goes back on Escape', () => {
    const { result, onMove } = setup();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.moving).toBeNull();
    act(() => {
      window.dispatchEvent(pointer('pointerup'));
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('takes its listeners with it when the page goes mid-move', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount, onMove } = setup();
    unmount();
    expect(remove.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel', 'keydown']),
    );
    window.dispatchEvent(pointer('pointerup'));
    expect(onMove).not.toHaveBeenCalled();
  });
});

// "Moving a slot": carried near the page's top or bottom edge, the page scrolls that way, faster the closer.
describe('a slot carried near the page’s edge', () => {
  it('scrolls the page by a step that grows towards the edge, and not in the middle', async () => {
    const { MOVE_SCROLL_EDGE_PX, MOVE_SCROLL_MAX_PX, moveScrollStep } =
      await import('./useSlotMove');
    expect(moveScrollStep(250, 0, 500)).toBe(0);
    expect(moveScrollStep(500 - MOVE_SCROLL_EDGE_PX + 1, 0, 500)).toBeGreaterThan(0);
    expect(moveScrollStep(500, 0, 500)).toBe(MOVE_SCROLL_MAX_PX);
    expect(moveScrollStep(0, 0, 500)).toBe(-MOVE_SCROLL_MAX_PX);
    expect(moveScrollStep(-40, 0, 500)).toBe(-MOVE_SCROLL_MAX_PX);
    expect(moveScrollStep(10, 0, 500)).toBeLessThan(moveScrollStep(40, 0, 500) || 0);
  });

  it('scrolls each frame while the pointer stays at the edge, and stops when the slot is let go', () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => frames.splice(0));
    const page = document.createElement('div');
    page.getBoundingClientRect = () => ({ top: 0, bottom: 500, left: 0, right: 400 }) as DOMRect;
    let top = 0;
    Object.defineProperty(page, 'scrollTop', {
      get: () => top,
      // A page cannot scroll above its top.
      set: (v: number) => (top = Math.max(0, v)),
    });
    const hook = renderHook(() =>
      useSlotMove({ pageRef: { current: page }, allowMove: () => () => true, onMove: vi.fn() }),
    );
    act(() => hook.result.current.beginMove('s', { clientX: 10, clientY: 10 }));
    const run = () => act(() => frames.shift()?.(0));
    run();
    // Near the top already scrolled to 0: nothing moves.
    expect(top).toBe(0);
    const near = new Event('pointermove') as Event & { clientX: number; clientY: number };
    Object.assign(near, { clientX: 10, clientY: 498 });
    act(() => {
      window.dispatchEvent(near);
    });
    run();
    run();
    expect(top).toBeGreaterThan(0);
    act(() => {
      window.dispatchEvent(pointer('pointerup'));
    });
    const at = top;
    run();
    expect(top).toBe(at);
  });
});
