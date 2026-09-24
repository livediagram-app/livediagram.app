// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCanvasSurfaceGestures } from './useCanvasSurfaceGestures';

// Only the context-menu routing is under test; every other dependency is an
// inert stub.
function setup(canvasTool = 'select') {
  const onCanvasContextMenu = vi.fn();
  const setMarquee = vi.fn();
  const setPan = vi.fn();
  const { result } = renderHook(() =>
    useCanvasSurfaceGestures({
      canvasTool,
      middleMousePan: true,
      pendingDraw: null,
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 1,
      mainRef: { current: null },
      wrapperRef: { current: null },
      spaceHeldRef: { current: false },
      setPan,
      setMarquee,
      spotlight: {},
      avatar: {},
      peerAvatars: [],
      isoCamera: {},
      canvasLongPress: { onPointerDown: vi.fn(), pressPoint: null },
      beginPendingDrawGesture: () => false,
      onCanvasContextMenu,
      onCanvasDoubleClick: vi.fn(),
    } as never),
  );
  return { result, onCanvasContextMenu, setMarquee, setPan };
}

const ctx = (buttons: number, button = 2) =>
  ({
    button,
    buttons,
    clientX: 50,
    clientY: 60,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as ReactMouseEvent;
const up = (button: number) =>
  ({ button, clientX: 50, clientY: 60 }) as unknown as ReactPointerEvent;

describe('canvas background context menu', () => {
  it('opens on the first click when contextmenu follows the release (Windows)', () => {
    const { result, onCanvasContextMenu } = setup();
    result.current.onContextMenuPointerUp(up(2));
    result.current.onContextMenu(ctx(0));
    expect(onCanvasContextMenu).toHaveBeenCalledWith(50, 60);
  });

  it('opens on the release when contextmenu comes first (macOS)', () => {
    const { result, onCanvasContextMenu } = setup();
    result.current.onContextMenu(ctx(2));
    expect(onCanvasContextMenu).not.toHaveBeenCalled();
    result.current.onContextMenuPointerUp(up(2));
    expect(onCanvasContextMenu).toHaveBeenCalledTimes(1);
  });

  it('drops the marquee / pan a Ctrl+click press armed, so its release cannot close the menu', () => {
    const { result, onCanvasContextMenu, setMarquee, setPan } = setup();
    result.current.onContextMenu(ctx(1, 0));
    expect(setMarquee).toHaveBeenCalledWith(null);
    expect(setPan).toHaveBeenCalledWith(null);
    result.current.onContextMenuPointerUp(up(0));
    expect(onCanvasContextMenu).toHaveBeenCalledTimes(1);
  });

  it.each(['spotlight', 'isometric', 'avatar'])('never opens in the %s tool', (tool) => {
    const { result, onCanvasContextMenu } = setup(tool);
    result.current.onContextMenu(ctx(0));
    result.current.onContextMenu(ctx(2));
    result.current.onContextMenuPointerUp(up(2));
    expect(onCanvasContextMenu).not.toHaveBeenCalled();
  });
});
