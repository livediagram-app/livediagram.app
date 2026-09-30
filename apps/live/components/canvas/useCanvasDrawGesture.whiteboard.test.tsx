// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { useCanvasDrawGesture } from './useCanvasDrawGesture';

function setup(pendingDraw: PendingDraw) {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
  const isPinchingRef = { current: false };
  const onCommitFreehand = vi.fn();
  const { result } = renderHook(() =>
    useCanvasDrawGesture({
      pendingDraw,
      elements: [],
      wrapperRef: { current: wrapper },
      viewportZoom: 1,
      isPinchingRef,
      onCommitDraw: vi.fn(),
      onCommitFreehand,
      stampAt: null,
      showStamp: vi.fn(),
    }),
  );
  const move = (x: number, y: number) =>
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }));
  const stroke = (pinchMidway: boolean) => {
    act(() => {
      result.current.beginPendingDrawGesture({ clientX: 0, clientY: 0 } as ReactPointerEvent);
    });
    act(() => {
      move(10, 10);
      if (pinchMidway) isPinchingRef.current = true;
      move(20, 20);
      window.dispatchEvent(new MouseEvent('pointerup'));
    });
  };
  return { stroke, onCommitFreehand };
}

const WB_PEN: PendingDraw = {
  type: 'freehand',
  variant: 'whiteboard',
  colour: null,
  width: 4,
  recognise: false,
};

describe('the pen gesture under a pinch', () => {
  it('discards a whiteboard stroke a second finger interrupted', () => {
    const s = setup(WB_PEN);
    s.stroke(true);
    expect(s.onCommitFreehand).not.toHaveBeenCalled();
  });

  it('commits an uninterrupted whiteboard stroke', () => {
    const s = setup(WB_PEN);
    s.stroke(false);
    expect(s.onCommitFreehand).toHaveBeenCalledTimes(1);
  });

  it('keeps the pencil\u2019s behaviour on a diagram tab', () => {
    const s = setup({ type: 'freehand' });
    s.stroke(true);
    expect(s.onCommitFreehand).toHaveBeenCalledTimes(1);
  });
});

describe('a whiteboard pen draws freely (docs/specs/023-whiteboard/whiteboard.md "No guides for pens")', () => {
  // A box whose left edge sits 3 px from where the stroke starts: close enough
  // that a pencil's first point snaps onto it.
  const box = {
    id: 'b',
    type: 'shape',
    shape: 'square',
    x: 103,
    y: 0,
    width: 50,
    height: 50,
  } as const;
  const firstPoint = (pendingDraw: PendingDraw) => {
    const wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
    const { result } = renderHook(() =>
      useCanvasDrawGesture({
        pendingDraw,
        elements: [box],
        wrapperRef: { current: wrapper },
        viewportZoom: 1,
        isPinchingRef: { current: false },
        onCommitDraw: vi.fn(),
        onCommitFreehand: vi.fn(),
        stampAt: null,
        showStamp: vi.fn(),
      }),
    );
    act(() => {
      result.current.beginPendingDrawGesture({ clientX: 100, clientY: 25 } as ReactPointerEvent);
    });
    const { penPoints, penStroke } = result.current;
    return penStroke ? penStroke.points[0]! : penPoints![0]!;
  };

  it('starts where the pen touches, unsnapped', () => {
    expect(firstPoint(WB_PEN)).toEqual({ x: 100, y: 25 });
  });

  it('still snaps a pencil on a diagram', () => {
    expect(firstPoint({ type: 'freehand' }).x).toBe(103);
  });
});

describe('a whiteboard pen draws through the live pipeline (docs/specs/023-whiteboard/whiteboard.md "Pens")', () => {
  it('starts a live stroke, not the pencil\u2019s sample buffer', () => {
    const wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
    const { result } = renderHook(() =>
      useCanvasDrawGesture({
        pendingDraw: WB_PEN,
        elements: [],
        wrapperRef: { current: wrapper },
        viewportZoom: 1,
        isPinchingRef: { current: false },
        onCommitDraw: vi.fn(),
        onCommitFreehand: vi.fn(),
        stampAt: null,
        showStamp: vi.fn(),
      }),
    );
    act(() => {
      result.current.beginPendingDrawGesture({ clientX: 5, clientY: 6 } as ReactPointerEvent);
    });
    expect(result.current.penPoints).toBeNull();
    expect(result.current.penStroke?.points).toEqual([{ x: 5, y: 6 }]);
  });
});
