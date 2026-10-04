// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canvasGestureNow, resetCanvasGesturesForTests } from '@/lib/canvas-gesture';
import { TOUCH_PAN_SLOP, useTouchPagePan } from './useTouchPagePan';

// A finger on an article page (docs/specs/007-editor/article-pages.md "A finger on a page"): it
// pans once it travels past the slop, and is a tap when it lifts short of it.

const press = (pointerType: string, x = 100, y = 100, isPrimary = true) =>
  ({ pointerType, isPrimary, pointerId: 1, clientX: x, clientY: y }) as ReactPointerEvent;

const fire = (type: string, props: { pointerId: number; clientX?: number; clientY?: number }) =>
  act(() => {
    window.dispatchEvent(Object.assign(new Event(type), props));
  });

function setup() {
  const move = vi.fn();
  const panFrom = vi.fn(() => move);
  const { result } = renderHook(() => useTouchPagePan(panFrom));
  return { handle: result.current, panFrom, move };
}

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  resetCanvasGesturesForTests();
});

describe('useTouchPagePan', () => {
  it('leaves a mouse or a pen press to the caller', () => {
    const { handle } = setup();
    expect(handle(press('mouse'))).toBe(false);
    expect(handle(press('pen'))).toBe(false);
  });

  it('leaves a press alone when nothing can pan the view', () => {
    const { result } = renderHook(() => useTouchPagePan(undefined));
    expect(result.current(press('touch'))).toBe(false);
  });

  it('is a tap when the finger lifts within the slop', () => {
    const { handle, panFrom } = setup();
    const onTap = vi.fn();
    expect(handle(press('touch'), onTap)).toBe(true);
    fire('pointermove', { pointerId: 1, clientX: 100 + TOUCH_PAN_SLOP, clientY: 100 });
    fire('pointerup', { pointerId: 1 });
    expect(onTap).toHaveBeenCalledOnce();
    expect(panFrom).not.toHaveBeenCalled();
  });

  it('pans by the drag once past the slop, as a pan gesture, and is no tap', () => {
    const { handle, panFrom, move } = setup();
    const onTap = vi.fn();
    handle(press('touch'), onTap);
    fire('pointermove', { pointerId: 1, clientX: 100, clientY: 60 });
    expect(panFrom).toHaveBeenCalledOnce();
    expect(canvasGestureNow()).toBe('pan');
    fire('pointermove', { pointerId: 1, clientX: 90, clientY: 20 });
    fire('pointerup', { pointerId: 1 });
    expect(move).toHaveBeenLastCalledWith(-10, -80);
    expect(onTap).not.toHaveBeenCalled();
    expect(canvasGestureNow()).toBe('idle');
  });

  it('ignores another pointer moving, and ends with no tap when a second finger lands', () => {
    const { handle, panFrom } = setup();
    const onTap = vi.fn();
    handle(press('touch'), onTap);
    fire('pointermove', { pointerId: 2, clientX: 0, clientY: 0 });
    expect(panFrom).not.toHaveBeenCalled();
    fire('pointerdown', { pointerId: 2 });
    fire('pointerup', { pointerId: 1 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it('ends with no tap on a cancel', () => {
    const { handle } = setup();
    const onTap = vi.fn();
    handle(press('touch'), onTap);
    fire('pointercancel', { pointerId: 1 });
    fire('pointerup', { pointerId: 1 });
    expect(onTap).not.toHaveBeenCalled();
  });

  it('leaves a second finger to the pinch', () => {
    const { handle } = setup();
    expect(handle(press('touch', 0, 0, false))).toBe(false);
  });
});
