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

// A rotated element is selected by the box it is drawn in (docs/specs/008-canvas/canvas-and-palette.md
// "Rotation"): its turned corners, not its unrotated box.
describe('useCanvasPanAndMarquee rotated elements', () => {
  // A 60 x 10 bar centred on (50, 50), stood upright: drawn across x 45..55, y 20..80.
  const bar = {
    id: 'r',
    type: 'shape',
    shape: 'square',
    x: 20,
    y: 45,
    width: 60,
    height: 10,
    rotation: 90,
  };
  function sweep(from: [number, number], to: [number, number]) {
    const deps = {
      viewportZoom: 1,
      setViewportOffset: vi.fn(),
      elements: [bar] as never,
      wrapperRef: {
        current: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 500 }) },
      } as never,
      onDeselect: vi.fn(),
      onSelectMarquee: vi.fn(),
    };
    const hook = renderHook(() => useCanvasPanAndMarquee(deps));
    act(() =>
      hook.result.current.setMarquee({
        startX: from[0],
        startY: from[1],
        currentX: from[0],
        currentY: from[1],
      }),
    );
    act(() => {
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: to[0], clientY: to[1] }));
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: to[0], clientY: to[1] }));
    });
    return deps.onSelectMarquee.mock.calls[0]![0] as Set<string>;
  }

  it('selects it when the box holds its drawn corners', () => {
    expect(sweep([40, 15], [60, 85])).toEqual(new Set(['r']));
  });

  it('leaves it when the box holds only its unrotated footprint', () => {
    expect(sweep([15, 40], [85, 60])).toEqual(new Set());
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

// A press that never moved is a tap: it runs the pan's own tap when it has one (a finger panning through a board,
// @liveworkspace/workbench/hooks/canvas/pan-through.ts), and otherwise deselects. A pinch is never a tap.
describe('useCanvasPanAndMarquee tap', () => {
  function tapSetup(pinching = false) {
    const onDeselect = vi.fn();
    const onTap = vi.fn();
    const view = renderHook(() =>
      useCanvasPanAndMarquee({
        viewportZoom: 1,
        setViewportOffset: vi.fn(),
        elements: [],
        wrapperRef: { current: null },
        onDeselect,
        onSelectMarquee: vi.fn(),
        isPinchingRef: { current: pinching },
      }),
    );
    const begin = (withTap: boolean) =>
      act(() =>
        view.result.current.setPan({
          startClientX: 10,
          startClientY: 10,
          startOffsetX: 0,
          startOffsetY: 0,
          movedRef: { current: false },
          ...(withTap ? { onTap } : {}),
        }),
      );
    const pointer = (type: string, x = 10) =>
      act(() => {
        window.dispatchEvent(Object.assign(new Event(type), { clientX: x, clientY: 10 }));
      });
    return { begin, pointer, onDeselect, onTap };
  }

  it('runs the tap instead of deselecting', () => {
    const t = tapSetup();
    t.begin(true);
    t.pointer('pointerup');
    expect(t.onTap).toHaveBeenCalledTimes(1);
    expect(t.onDeselect).not.toHaveBeenCalled();
  });

  it('deselects on a tap with no tap of its own', () => {
    const t = tapSetup();
    t.begin(false);
    t.pointer('pointerup');
    expect(t.onDeselect).toHaveBeenCalledTimes(1);
  });

  it('is no tap once the press moved', () => {
    const t = tapSetup();
    t.begin(true);
    t.pointer('pointermove', 60);
    t.pointer('pointerup', 60);
    expect(t.onTap).not.toHaveBeenCalled();
  });

  it('is no tap once a second finger made it a pinch', () => {
    const t = tapSetup(true);
    t.begin(true);
    t.pointer('pointermove', 11);
    t.pointer('pointerup', 11);
    expect(t.onTap).not.toHaveBeenCalled();
    expect(t.onDeselect).not.toHaveBeenCalled();
  });
});
