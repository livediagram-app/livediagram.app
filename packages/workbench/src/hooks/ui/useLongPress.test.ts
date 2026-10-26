// @vitest-environment jsdom
// The touch long press (docs/specs/008-canvas/canvas-and-palette.md, press and hold): a finger held still fires it;
// moving, lifting or `cancel` (a second finger joining: a pinch) lets it go, and only the last press is armed.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { LONG_PRESS_MS, useLongPress } from './useLongPress';

afterEach(() => vi.useRealTimers());

const press = (x: number, y: number, pointerType = 'touch') =>
  ({ pointerType, clientX: x, clientY: y }) as ReactPointerEvent;

function setup() {
  vi.useFakeTimers();
  const fired = vi.fn();
  const hook = renderHook(() => useLongPress(fired));
  return { fired, hook };
}

describe('useLongPress', () => {
  it('fires for a finger held still, at the press point', () => {
    const { fired, hook } = setup();
    act(() => hook.result.current.onPointerDown(press(30, 40)));
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(fired).toHaveBeenCalledWith(30, 40);
  });

  it('ignores a mouse, and lets go on cancel', () => {
    const { fired, hook } = setup();
    act(() => hook.result.current.onPointerDown(press(30, 40, 'mouse')));
    act(() => hook.result.current.onPointerDown(press(30, 40)));
    act(() => hook.result.current.cancel());
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS * 2);
    });
    expect(fired).not.toHaveBeenCalled();
    expect(hook.result.current.pressPoint).toBeNull();
  });

  it('arms only the last press: an earlier one’s listeners come off', () => {
    const { fired, hook } = setup();
    const off = vi.spyOn(window, 'removeEventListener');
    act(() => hook.result.current.onPointerDown(press(10, 10)));
    act(() => hook.result.current.onPointerDown(press(50, 50)));
    expect(off.mock.calls.filter(([type]) => type === 'pointerup')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(fired).toHaveBeenCalledTimes(1);
    expect(fired).toHaveBeenCalledWith(50, 50);
  });

  it('takes its window listeners off when unmounted mid-hold', () => {
    const { fired, hook } = setup();
    const off = vi.spyOn(window, 'removeEventListener');
    act(() => hook.result.current.onPointerDown(press(10, 10)));
    hook.unmount();
    expect(off.mock.calls.map(([type]) => type).sort()).toEqual([
      'pointercancel',
      'pointermove',
      'pointerup',
    ]);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(fired).not.toHaveBeenCalled();
  });
});
