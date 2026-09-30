// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  EdgeResizeHandle,
  ResizeHandles,
  UnionResizeHandles,
} from '@/components/canvas/element-parts';
import { useCanvasSurfaceGestures } from './useCanvasSurfaceGestures';

// On a whiteboard, Shift + press drags a selection box, but a resize handle keeps its own Shift
// behaviour (docs/specs/023-whiteboard/whiteboard.md "Selecting"), which is keeping the aspect
// ratio (docs/specs/008-canvas/canvas-and-palette.md "Resize"). Every resize handle, corner, edge
// and multi-selection alike, must reach its resize with Shift held.

function setup(wrapper: HTMLElement) {
  const setMarquee = vi.fn();
  const { result } = renderHook(() =>
    useCanvasSurfaceGestures({
      canvasTool: 'select',
      middleMousePan: true,
      pendingDraw: null,
      whiteboard: true,
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 1,
      mainRef: { current: null },
      wrapperRef: { current: wrapper },
      spaceHeldRef: { current: false },
      setPan: vi.fn(),
      setMarquee,
      spotlight: {},
      avatar: {},
      peerAvatars: [],
      isoCamera: {},
      canvasLongPress: { onPointerDown: vi.fn(), pressPoint: null },
      beginPendingDrawGesture: () => false,
      onCanvasContextMenu: vi.fn(),
      onCanvasDoubleClick: vi.fn(),
    } as never),
  );
  const shiftPress = (target: Element) =>
    result.current.onPointerDownCapture({
      button: 0,
      shiftKey: true,
      clientX: 10,
      clientY: 10,
      target,
      currentTarget: wrapper.parentElement,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as ReactPointerEvent);
  return { shiftPress, setMarquee };
}

afterEach(cleanup);

const noop = () => {};

describe('whiteboard Shift + press on a resize handle', () => {
  it.each([
    ['a corner handle', <ResizeHandles key="c" elementId="a" zoom={1} onBeginDrag={noop} />],
    [
      'an edge handle',
      <EdgeResizeHandle key="e" anchor="e" elementId="a" zoom={1} onBeginDrag={noop} />,
    ],
    [
      'a multi-selection handle',
      <UnionResizeHandles
        key="u"
        bounds={{ x: 0, y: 0, width: 100, height: 100 }}
        primaryId="a"
        zoom={1}
        onBeginDrag={noop}
      />,
    ],
  ])('leaves %s to resize, not a selection box', (_, handle) => {
    const { container } = render(<div data-testid="wrapper">{handle}</div>);
    const wrapper = container.firstElementChild as HTMLElement;
    const grip = wrapper.querySelector('[class*="pointer-events-auto"]')!;
    const { shiftPress, setMarquee } = setup(wrapper);
    shiftPress(grip);
    expect(setMarquee).not.toHaveBeenCalled();
  });

  it('still drags a selection box from the bare board', () => {
    const { container } = render(<div />);
    const wrapper = container.firstElementChild as HTMLElement;
    const { shiftPress, setMarquee } = setup(wrapper);
    shiftPress(wrapper);
    expect(setMarquee).toHaveBeenCalledWith(expect.objectContaining({ additive: true }));
  });
});
