// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { penSeen, resetPenSeenForTests } from '@/lib/pen-seen';
import { useCanvasSurfaceGestures } from './useCanvasSurfaceGestures';

// docs/specs/023-whiteboard/whiteboard.md "Touch and pen input".
const PEN: PendingDraw = {
  type: 'freehand',
  variant: 'whiteboard',
  colour: null,
  width: 4,
  recognise: false,
};

function setup(whiteboard: boolean, pendingDraw: PendingDraw | null = PEN) {
  const setPan = vi.fn();
  const beginPendingDrawGesture = vi.fn(() => true);
  const main = document.createElement('main');
  const { result } = renderHook(() =>
    useCanvasSurfaceGestures({
      canvasTool: 'select',
      middleMousePan: true,
      pendingDraw,
      whiteboard,
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 1,
      mainRef: { current: main },
      wrapperRef: { current: null },
      spaceHeldRef: { current: false },
      setPan,
      setMarquee: vi.fn(),
      spotlight: {},
      avatar: {},
      peerAvatars: [],
      isoCamera: {},
      canvasLongPress: { onPointerDown: vi.fn(), pressPoint: null },
      beginPendingDrawGesture,
      onCanvasContextMenu: vi.fn(),
      onCanvasDoubleClick: vi.fn(),
    } as never),
  );
  const press = (pointerType: string) =>
    result.current.onPointerDownCapture({
      button: 0,
      pointerType,
      clientX: 10,
      clientY: 10,
      target: main,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as ReactPointerEvent);
  return { press, setPan, beginPendingDrawGesture };
}

afterEach(() => resetPenSeenForTests());

describe('whiteboard pen versus touch', () => {
  it('lets a finger draw until a pen has been seen', () => {
    const s = setup(true);
    s.press('touch');
    expect(s.beginPendingDrawGesture).toHaveBeenCalled();
    expect(s.setPan).not.toHaveBeenCalled();
  });

  it('pans a finger once a pen has been used, and the pen still draws', () => {
    const s = setup(true);
    s.press('pen');
    expect(penSeen()).toBe(true);
    expect(s.beginPendingDrawGesture).toHaveBeenCalledTimes(1);
    s.press('touch');
    expect(s.setPan).toHaveBeenCalledTimes(1);
    expect(s.beginPendingDrawGesture).toHaveBeenCalledTimes(1);
  });

  it('never changes a diagram tab', () => {
    const s = setup(false);
    s.press('pen');
    s.press('touch');
    expect(s.setPan).not.toHaveBeenCalled();
    expect(s.beginPendingDrawGesture).toHaveBeenCalledTimes(2);
  });
});
