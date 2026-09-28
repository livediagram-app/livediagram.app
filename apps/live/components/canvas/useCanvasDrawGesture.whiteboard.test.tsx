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
