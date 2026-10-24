// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { LONG_PRESS_MS } from '@/hooks/ui/useLongPress';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCanvasSurfaceGestures } from './useCanvasSurfaceGestures';

// Only the context-menu routing is under test; every other dependency is an
// inert stub.
function setup(canvasTool = 'select', { readOnly = false } = {}) {
  // One log for both, so a test can read the order: deselect, then open.
  const calls: string[] = [];
  const onCanvasContextMenu = vi.fn(() => calls.push('menu'));
  const onDeselect = vi.fn(() => calls.push('deselect'));
  const setMarquee = vi.fn();
  const setPan = vi.fn();
  const { result } = renderHook(() =>
    useCanvasSurfaceGestures({
      canvasTool,
      middleMousePan: true,
      viewportOffset: { x: 0, y: 0 },
      viewportZoom: 1,
      mainRef: { current: null },
      wrapperRef: { current: null },
      spaceHeldRef: { current: false },
      setPan,
      setMarquee,
      onCanvasContextMenu: readOnly ? undefined : onCanvasContextMenu,
      onDeselect,
      onCanvasDoubleClick: vi.fn(),
    } as never),
  );
  return { result, onCanvasContextMenu, onDeselect, setMarquee, setPan, calls };
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

});

// docs/specs/008-canvas/canvas-and-palette.md "Selection": right-clicking the empty canvas
// deselects, then opens the canvas menu; a long-press on touch does the same.
describe('a right-click on the empty canvas', () => {
  it('deselects, then opens the canvas menu (Windows order)', () => {
    const { result, calls } = setup();
    result.current.onContextMenuPointerUp(up(2));
    result.current.onContextMenu(ctx(0));
    expect(calls).toEqual(['deselect', 'menu']);
  });

  it('deselects on the release, as the menu opens (macOS order)', () => {
    const { result, calls } = setup();
    result.current.onContextMenu(ctx(2));
    expect(calls).toEqual([]);
    result.current.onContextMenuPointerUp(up(2));
    expect(calls).toEqual(['deselect', 'menu']);
  });

  it('deselects on a macOS Ctrl+click too', () => {
    const { result, calls } = setup();
    result.current.onContextMenu(ctx(1, 0));
    result.current.onContextMenuPointerUp(up(0));
    expect(calls).toEqual(['deselect', 'menu']);
  });

  it('keeps the selection when the right press became a drag', () => {
    const { result, calls } = setup();
    result.current.onContextMenu(ctx(2));
    result.current.onContextMenuPointerUp({
      button: 2,
      clientX: 150,
      clientY: 60,
    } as unknown as ReactPointerEvent);
    expect(calls).toEqual([]);
  });

  it('deselects where there is no canvas menu to open (view role)', () => {
    const { result, calls } = setup('select', { readOnly: true });
    result.current.onContextMenu(ctx(0));
    expect(calls).toEqual(['deselect']);
  });

});

describe('a long-press on the empty canvas', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const touch = (over: Record<string, unknown> = {}) =>
    ({
      button: 0,
      pointerType: 'touch',
      clientX: 70,
      clientY: 80,
      shiftKey: false,
      target: {},
      currentTarget: {},
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
      ...over,
    }) as unknown as ReactPointerEvent;

  it('drops the press gesture, deselects, then opens the canvas menu', () => {
    vi.useFakeTimers();
    const { result, calls, setMarquee, setPan, onCanvasContextMenu } = setup();
    act(() => result.current.onPointerDown(touch()));
    expect(calls).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(calls).toEqual(['deselect', 'menu']);
    expect(onCanvasContextMenu).toHaveBeenCalledWith(70, 80);
    expect(setMarquee).toHaveBeenCalledWith(null);
    expect(setPan).toHaveBeenCalledWith(null);
  });

  it('keeps the selection when the finger lifts first (a tap)', () => {
    vi.useFakeTimers();
    const { result, calls } = setup();
    act(() => result.current.onPointerDown(touch()));
    act(() => {
      window.dispatchEvent(new Event('pointerup'));
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(calls).toEqual([]);
  });

  it('exposes the hold point for the press-and-hold ring', () => {
    vi.useFakeTimers();
    const { result } = setup();
    act(() => result.current.onPointerDown(touch()));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.canvasLongPress.pressPoint).toEqual({ x: 70, y: 80 });
  });
});

// docs/specs/026-plan/plan-board.md "On a phone": a finger on a board's empty space pans the canvas.
describe('a press that pans through an element', () => {
  it('pans whatever the tool, from inside an element, and arms no menu', async () => {
    const { markPanThrough } = await import('./pan-through');
    vi.useFakeTimers();
    const { result, setPan, setMarquee, onCanvasContextMenu } = setup('select');
    const inner = document.createElement('div');
    const nativeEvent = new Event('pointerdown');
    const press = {
      button: 0,
      pointerType: 'touch',
      clientX: 10,
      clientY: 20,
      target: inner,
      currentTarget: document.createElement('main'),
      nativeEvent,
    } as unknown as ReactPointerEvent;
    markPanThrough(press);
    result.current.onPointerDown(press);
    expect(setPan).toHaveBeenCalledWith(
      expect.objectContaining({ startClientX: 10, startClientY: 20 }),
    );
    expect(setMarquee).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS + 50);
    });
    expect(onCanvasContextMenu).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

// docs/specs/026-plan/plan-board.md "Maximised board": a press on a maximised or tab-filling board (or the cover
// around it) is never a canvas gesture, whatever the tool.
describe('a press on the canvas cover', () => {
  it('starts no canvas gesture, while one elsewhere still does', () => {
    const interceptPress = vi.fn(() => true);
    const { result } = renderHook(() =>
      useCanvasSurfaceGestures({
        canvasTool: 'select',
        middleMousePan: true,
          viewportOffset: { x: 0, y: 0 },
        viewportZoom: 1,
        mainRef: { current: null },
        wrapperRef: { current: null },
        spaceHeldRef: { current: false },
        setPan: vi.fn(),
        setMarquee: vi.fn(),
            onDeselect: vi.fn(),
        onCanvasDoubleClick: vi.fn(),
        interceptPress,
      } as never),
    );
    const cover = document.createElement('div');
    cover.setAttribute('data-canvas-cover', '');
    const card = document.createElement('button');
    cover.appendChild(card);
    const press = (target: Element) =>
      ({
        target,
        button: 0,
        clientX: 5,
        clientY: 5,
        pointerType: 'mouse',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }) as unknown as ReactPointerEvent;
    result.current.onPointerDownCapture(press(card));
    result.current.onPointerDownCapture(press(cover));
    expect(interceptPress).not.toHaveBeenCalled();
    result.current.onPointerDownCapture(press(document.createElement('div')));
    expect(interceptPress).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Touch (iOS / iPad)": a press panning through an element hands its tap to the pan.
describe('a pan-through press with a tap', () => {
  it('carries the tap into the pan', async () => {
    const { markPanThrough } = await import('./pan-through');
    const { result, setPan } = setup('pan');
    const onTap = vi.fn();
    const press = {
      button: 0,
      pointerType: 'touch',
      clientX: 1,
      clientY: 2,
      target: document.createElement('div'),
      currentTarget: document.createElement('main'),
      nativeEvent: new Event('pointerdown'),
    } as unknown as ReactPointerEvent;
    markPanThrough(press, onTap);
    result.current.onPointerDown(press);
    expect(setPan).toHaveBeenCalledWith(expect.objectContaining({ onTap }));
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Double-tap to zoom": the double-click carries who pressed.
describe('a double press on the bare canvas', () => {
  function dblSetup(canvasTool = 'select') {
    const onCanvasDoubleClick = vi.fn();
    const wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 20,
        right: 410,
        bottom: 820,
        x: 10,
        y: 20,
        width: 400,
        height: 800,
      }) as DOMRect;
    const { result } = renderHook(() =>
      useCanvasSurfaceGestures({
        canvasTool,
        middleMousePan: true,
          viewportOffset: { x: 0, y: 0 },
        viewportZoom: 2,
        mainRef: { current: null },
        wrapperRef: { current: wrapper },
        spaceHeldRef: { current: false },
        setPan: vi.fn(),
        setMarquee: vi.fn(),
          onDeselect: vi.fn(),
        onCanvasDoubleClick,
      } as never),
    );
    const press = (pointerType: string) =>
      result.current.onPointerDownCapture({
        target: document.createElement('div'),
        button: 0,
        clientX: 110,
        clientY: 220,
        pointerType,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as ReactPointerEvent);
    const dbl = (target: Element = wrapper) =>
      result.current.onWrapperDoubleClick({
        target,
        currentTarget: wrapper,
        clientX: 110,
        clientY: 220,
      } as unknown as ReactMouseEvent);
    const surface = document.createElement('main');
    const dblSurface = (target: Element = surface) =>
      result.current.onSurfaceDoubleClick({
        target,
        currentTarget: surface,
        clientX: 610,
        clientY: 20,
      } as unknown as ReactMouseEvent);
    return { press, dbl, dblSurface, onCanvasDoubleClick, result };
  }

  it("zooms on a finger's double-tap on the bare surface around the zoomed-out content", () => {
    const { press, dblSurface, onCanvasDoubleClick, result } = dblSetup();
    press('touch');
    expect(result.current.pressedByFinger()).toBe(true);
    dblSurface();
    // Outside the wrapper's rect, by the same linear mapping.
    expect(onCanvasDoubleClick).toHaveBeenCalledWith(300, 0, true);
  });

  it('leaves the bare surface alone for a mouse and for anything on it', () => {
    const mouse = dblSetup();
    mouse.press('mouse');
    expect(mouse.result.current.pressedByFinger()).toBe(false);
    mouse.dblSurface();
    expect(mouse.onCanvasDoubleClick).not.toHaveBeenCalled();

    const child = dblSetup();
    child.press('touch');
    child.dblSurface(document.createElement('div'));
    expect(child.onCanvasDoubleClick).not.toHaveBeenCalled();
  });

  it("says a finger's double-tap was a finger's, at the tapped canvas point", () => {
    const { press, dbl, onCanvasDoubleClick } = dblSetup();
    press('touch');
    press('touch');
    dbl();
    expect(onCanvasDoubleClick).toHaveBeenCalledWith(50, 100, true);
  });

  it.each(['mouse', 'pen'])("says a %s's double-click was not", (pointerType) => {
    const { press, dbl, onCanvasDoubleClick } = dblSetup();
    press(pointerType);
    dbl();
    expect(onCanvasDoubleClick).toHaveBeenCalledWith(50, 100, false);
  });

  it('treats a double-click with no press seen as a mouse', () => {
    const { dbl, onCanvasDoubleClick } = dblSetup();
    dbl();
    expect(onCanvasDoubleClick).toHaveBeenCalledWith(50, 100, false);
  });

  it('ignores a double press on anything but the bare canvas', () => {
    const { press, dbl, onCanvasDoubleClick } = dblSetup();
    press('touch');
    dbl(document.createElement('div'));
    expect(onCanvasDoubleClick).not.toHaveBeenCalled();
  });
});
