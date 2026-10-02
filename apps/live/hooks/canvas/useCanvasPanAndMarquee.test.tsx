// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasGestureNow, resetCanvasGesturesForTests } from '@/lib/canvas-gesture';
import { useCanvasPanAndMarquee } from './useCanvasPanAndMarquee';

// Held Space turns a canvas drag into a pan (docs/specs/008-canvas/canvas-and-palette.md). The pointerdown reads the
// ref; the cursor is rendered from the state, so both must follow the key.
function setup() {
  return renderHook(() =>
    useCanvasPanAndMarquee({
      viewportZoom: 1,
      setViewportOffset: vi.fn(),
      elements: [],
      wrapperRef: { current: null },
      onDeselect: vi.fn(),
      onSelectMarquee: vi.fn(),
    }),
  );
}

const key = (type: 'keydown' | 'keyup', target: EventTarget = document.body) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent(type, { code: 'Space', bubbles: true }));
  });

describe('useCanvasPanAndMarquee space-held modifier', () => {
  it('renders held while Space is down, and released on keyup', () => {
    const { result } = setup();
    expect(result.current.spaceHeld).toBe(false);

    key('keydown');
    expect(result.current.spaceHeld).toBe(true);
    expect(result.current.spaceHeldRef.current).toBe(true);

    key('keyup');
    expect(result.current.spaceHeld).toBe(false);
    expect(result.current.spaceHeldRef.current).toBe(false);
  });

  it('ignores Space typed into a text field', () => {
    const { result } = setup();
    const input = document.createElement('input');
    document.body.append(input);
    key('keydown', input);
    expect(result.current.spaceHeld).toBe(false);
    expect(result.current.spaceHeldRef.current).toBe(false);
    input.remove();
  });
});

// docs/specs/023-whiteboard/whiteboard.md "Selecting": Shift with Select on a whiteboard always
// drags a selection box that adds to the selection; a Shift-click on an element toggles it.
describe('useCanvasPanAndMarquee additive marquee', () => {
  const square = { id: 'a', type: 'shape', shape: 'square', x: 10, y: 10, width: 20, height: 20 };
  function additive(current: string[] = ['z']) {
    const deps = {
      viewportZoom: 1,
      setViewportOffset: vi.fn(),
      elements: [square] as never,
      wrapperRef: {
        current: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 500 }) },
      } as never,
      onDeselect: vi.fn(),
      onSelectMarquee: vi.fn(),
      onShiftSelect: vi.fn(),
      currentSelection: () => new Set(current),
    };
    const hook = renderHook(() => useCanvasPanAndMarquee(deps));
    return { deps, hook };
  }
  const up = (x: number, y: number) =>
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }));
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y }));
    });

  it('adds what the box encloses to the selection', () => {
    const { deps, hook } = additive();
    act(() =>
      hook.result.current.setMarquee({
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        additive: true,
      }),
    );
    up(100, 100);
    expect(deps.onSelectMarquee).toHaveBeenCalledWith(new Set(['z', 'a']));
  });

  it('toggles the pressed element on a click, and never deselects', () => {
    const { deps, hook } = additive();
    act(() =>
      hook.result.current.setMarquee({
        startX: 15,
        startY: 15,
        currentX: 15,
        currentY: 15,
        additive: true,
        clickTarget: 'a',
      }),
    );
    up(16, 15);
    expect(deps.onShiftSelect).toHaveBeenCalledWith('a');
    expect(deps.onDeselect).not.toHaveBeenCalled();
  });

  it('keeps the selection on a Shift-click on empty board', () => {
    const { deps, hook } = additive();
    act(() =>
      hook.result.current.setMarquee({
        startX: 300,
        startY: 300,
        currentX: 300,
        currentY: 300,
        additive: true,
      }),
    );
    up(300, 300);
    expect(deps.onDeselect).not.toHaveBeenCalled();
    expect(deps.onShiftSelect).not.toHaveBeenCalled();
  });
});

// docs/specs/008-canvas/canvas-performance.md: a pan and a marquee are canvas gestures.
describe('useCanvasPanAndMarquee gestures', () => {
  afterEach(() => resetCanvasGesturesForTests());

  it('opens a pan for as long as one is held', () => {
    const { result } = setup();
    act(() =>
      result.current.setPan({
        startClientX: 0,
        startClientY: 0,
        startOffsetX: 0,
        startOffsetY: 0,
        movedRef: { current: false },
      }),
    );
    expect(canvasGestureNow()).toBe('pan');
    act(() => result.current.setPan(null));
    expect(canvasGestureNow()).toBe('idle');
  });

  it('opens one marquee however often the box moves', () => {
    const { result } = setup();
    act(() => result.current.setMarquee({ startX: 0, startY: 0, currentX: 0, currentY: 0 }));
    expect(canvasGestureNow()).toBe('marquee');
    act(() => result.current.setMarquee((m) => (m ? { ...m, currentX: 40 } : m)));
    act(() => result.current.setMarquee(null));
    expect(canvasGestureNow()).toBe('idle');
  });

  it('closes an open gesture on unmount', () => {
    const { result, unmount } = setup();
    act(() => result.current.setMarquee({ startX: 0, startY: 0, currentX: 0, currentY: 0 }));
    unmount();
    expect(canvasGestureNow()).toBe('idle');
  });
});
