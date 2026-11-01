// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFillPress } from './useFillPress';

// livediagram docs/specs/023-draw-mode/fill-tool.md "Input".
function setup(armed = true, pinching = false) {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () => ({ left: 10, top: 20 }) as DOMRect;
  const onPaintBucket = vi.fn();
  const hook = renderHook(
    (p: { armed: boolean }) =>
      useFillPress({
        armed: p.armed,
        wrapperRef: { current: wrapper },
        viewportZoom: 2,
        isPinchingRef: { current: pinching },
        onPaintBucket,
      }),
    { initialProps: { armed } },
  );
  return { hook, onPaintBucket };
}

const down = (id = 1, x = 110, y = 220, button = 0) =>
  ({
    pointerId: id,
    clientX: x,
    clientY: y,
    button,
    preventDefault: vi.fn(),
  }) as unknown as React.PointerEvent;

function fire(type: 'pointerdown' | 'pointerup' | 'pointercancel', id: number, x = 110, y = 220) {
  const ev = new Event(type) as PointerEvent;
  Object.assign(ev, { pointerId: id, clientX: x, clientY: y });
  act(() => {
    window.dispatchEvent(ev);
  });
}

afterEach(() => vi.restoreAllMocks());

describe('useFillPress', () => {
  it('fills on release where the press went down, in canvas px', () => {
    const { hook, onPaintBucket } = setup();
    expect(hook.result.current.beginFillPress(down())).toBe(true);
    fire('pointerup', 1, 113, 222);
    expect(onPaintBucket).toHaveBeenCalledWith({ x: 50, y: 100 });
    // Released: a stray later release does nothing.
    fire('pointerup', 1);
    expect(onPaintBucket).toHaveBeenCalledTimes(1);
  });

  it('claims nothing without the bucket in hand, a handler, or the main button', () => {
    expect(setup(false).hook.result.current.beginFillPress(down())).toBe(false);
    expect(setup().hook.result.current.beginFillPress(down(1, 0, 0, 2))).toBe(false);
    const { result } = renderHook(() =>
      useFillPress({ armed: true, wrapperRef: { current: null }, viewportZoom: 1 }),
    );
    expect(result.current.beginFillPress(down())).toBe(false);
    // With a handler but no canvas to measure, the press is claimed and fills nothing.
    const onPaintBucket = vi.fn();
    const bare = renderHook(() =>
      useFillPress({ armed: true, wrapperRef: { current: null }, viewportZoom: 1, onPaintBucket }),
    );
    expect(bare.result.current.beginFillPress(down())).toBe(true);
    // Its own pointer seen again by the window is not a second finger.
    fire('pointerdown', 1);
    fire('pointerup', 1);
    expect(onPaintBucket).not.toHaveBeenCalled();
  });

  it('fills nothing for a drag, a pinch, a cancel or a missing canvas', () => {
    const { hook, onPaintBucket } = setup();
    hook.result.current.beginFillPress(down());
    fire('pointerup', 1, 110 + 6, 220);
    // A second finger, seen by the window and again by the canvas.
    hook.result.current.beginFillPress(down());
    fire('pointerdown', 2);
    expect(hook.result.current.beginFillPress(down(2))).toBe(true);
    fire('pointerup', 2);
    fire('pointerup', 1);
    hook.result.current.beginFillPress(down());
    fire('pointercancel', 2);
    fire('pointercancel', 1);
    fire('pointerup', 1);
    expect(onPaintBucket).not.toHaveBeenCalled();
    const pinching = setup(true, true);
    pinching.hook.result.current.beginFillPress(down());
    fire('pointerup', 1);
    expect(pinching.onPaintBucket).not.toHaveBeenCalled();
  });

  it('starts afresh when the same pointer goes down again, and drops a press when put down', () => {
    const { hook, onPaintBucket } = setup();
    hook.result.current.beginFillPress(down());
    hook.result.current.beginFillPress(down(1, 300, 300));
    fire('pointerup', 1, 300, 300);
    expect(onPaintBucket).toHaveBeenCalledWith({ x: 145, y: 140 });
    hook.result.current.beginFillPress(down());
    hook.rerender({ armed: false });
    fire('pointerup', 1);
    expect(onPaintBucket).toHaveBeenCalledTimes(1);
    hook.unmount();
  });
});
