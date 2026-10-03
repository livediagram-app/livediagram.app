// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WHEEL_SETTLE_MS,
  canvasGestureNow,
  resetCanvasGesturesForTests,
} from '@/lib/canvas-gesture';
import { useCanvasPinchZoom } from './useCanvasPinchZoom';

// docs/specs/008-canvas/canvas-performance.md: a wheel pan or zoom is a canvas gesture that ends
// WHEEL_SETTLE_MS after the last wheel event; a touch pinch is a zoom from start to end.

let canvas: HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  canvas = document.createElement('main');
  document.body.append(canvas);
});

afterEach(() => {
  vi.useRealTimers();
  canvas.remove();
  resetCanvasGesturesForTests();
});

function setup() {
  return renderHook(() =>
    useCanvasPinchZoom({
      canvasMainRef: { current: canvas },
      viewportZoom: 1,
      viewportOffset: { x: 0, y: 0 },
      setViewportZoom: vi.fn(),
      setViewportOffset: vi.fn(),
    } as never),
  );
}

const wheel = (init: WheelEventInit) =>
  act(() => {
    canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init }));
  });

describe('useCanvasPinchZoom gestures', () => {
  it('opens a pan on a plain wheel and closes it once the wheel settles', () => {
    setup();
    wheel({ deltaY: 10 });
    expect(canvasGestureNow()).toBe('pan');
    act(() => vi.advanceTimersByTime(WHEEL_SETTLE_MS - 1));
    wheel({ deltaY: 10 });
    act(() => vi.advanceTimersByTime(WHEEL_SETTLE_MS - 1));
    expect(canvasGestureNow()).toBe('pan');
    act(() => vi.advanceTimersByTime(1));
    expect(canvasGestureNow()).toBe('idle');
  });

  it('opens a zoom on a Ctrl-wheel, switching from a pan in flight', () => {
    setup();
    wheel({ deltaY: 10 });
    wheel({ deltaY: -10, ctrlKey: true });
    expect(canvasGestureNow()).toBe('zoom');
    act(() => vi.advanceTimersByTime(WHEEL_SETTLE_MS));
    expect(canvasGestureNow()).toBe('idle');
  });

  it('closes a settling wheel gesture on unmount', () => {
    const { unmount } = setup();
    wheel({ deltaY: 10 });
    unmount();
    expect(canvasGestureNow()).toBe('idle');
  });
});
