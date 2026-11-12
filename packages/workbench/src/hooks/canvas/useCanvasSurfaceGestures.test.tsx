// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { LONG_PRESS_MS } from '../ui/useLongPress';
import { markPanThrough } from './pan-through';
import {
  useCanvasSurfaceGestures,
  type CanvasSurfaceGestureArgs,
  type CanvasSurfaceGestureOptions,
} from './useCanvasSurfaceGestures';
import { useFocusCanvasOnMount } from './useFocusCanvasOnMount';

// The editors' own tests drive their bindings (hooks/canvas/useCanvasSurfaceGestures in each); these cover every
// branch of the shared routing, with every dependency a stub.
function setup(
  over: Partial<CanvasSurfaceGestureArgs> = {},
  options?: CanvasSurfaceGestureOptions,
) {
  const calls: string[] = [];
  const main = document.createElement('main');
  main.tabIndex = -1;
  const wrapper = document.createElement('div');
  main.append(wrapper);
  document.body.append(main);
  wrapper.getBoundingClientRect = () => ({ left: 10, top: 20 }) as DOMRect;
  const args: CanvasSurfaceGestureArgs = {
    canvasTool: 'select',
    middleMousePan: true,
    pendingDraw: null,
    viewportOffset: { x: 3, y: 4 },
    viewportZoom: 2,
    mainRef: { current: main },
    wrapperRef: { current: wrapper },
    spaceHeldRef: { current: false },
    setPan: vi.fn(),
    setMarquee: vi.fn(),
    spotlight: { grow: vi.fn(), shrink: vi.fn() },
    beginPendingDrawGesture: vi.fn(() => true),
    onCanvasContextMenu: vi.fn(() => calls.push('menu')),
    onDeselect: vi.fn(() => calls.push('deselect')),
    onCanvasDoubleClick: vi.fn(),
    ...over,
  };
  const { result } = renderHook(() => useCanvasSurfaceGestures(args, options));
  return { result, args, main, wrapper, calls };
}

const press = (over: Record<string, unknown> = {}) =>
  ({
    button: 0,
    pointerType: 'mouse',
    clientX: 50,
    clientY: 60,
    target: null,
    currentTarget: null,
    nativeEvent: new Event('pointerdown'),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...over,
  }) as unknown as ReactPointerEvent;

const click = (over: Record<string, unknown> = {}) =>
  ({
    button: 2,
    buttons: 0,
    clientX: 50,
    clientY: 60,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...over,
  }) as unknown as ReactMouseEvent;

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('the capture-phase press', () => {
  it('leaves floating panels, the corner cluster, a cover and a portal alone', () => {
    const { result, args, main } = setup({ canvasTool: 'spotlight' }, { ignoreCoverPresses: true });
    for (const attr of ['data-floating-panel', 'data-zoom-cluster', 'data-canvas-cover']) {
      const el = document.createElement('div');
      el.setAttribute(attr, '');
      main.append(el);
      result.current.onPointerDownCapture(press({ target: el }));
    }
    const portal = document.createElement('div');
    document.body.append(portal);
    result.current.onPointerDownCapture(press({ target: portal }));
    expect(args.spotlight!.grow).not.toHaveBeenCalled();
  });

  it('takes a press on a cover only where the editor asks', () => {
    const { result, args, main } = setup({ canvasTool: 'spotlight' });
    const cover = document.createElement('div');
    cover.setAttribute('data-canvas-cover', '');
    main.append(cover);
    result.current.onPointerDownCapture(press({ target: cover }));
    expect(args.spotlight!.grow).toHaveBeenCalled();
  });

  it('hands the press to a tool that owns it', () => {
    const interceptPress = vi.fn(() => true);
    const { result, main, args } = setup({ interceptPress, pendingDraw: {} });
    const e = press({ target: main });
    result.current.onPointerDownCapture(e);
    expect(document.activeElement).toBe(main);
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(args.beginPendingDrawGesture).not.toHaveBeenCalled();
  });

  it('grows the Spotlight on a primary press and swallows a secondary one', () => {
    const { result, main, args } = setup({ canvasTool: 'spotlight' });
    result.current.onPointerDownCapture(press({ target: main }));
    const secondary = press({ target: main, button: 2 });
    result.current.onPointerDownCapture(secondary);
    expect(args.spotlight!.grow).toHaveBeenCalledTimes(1);
    expect(secondary.stopPropagation).toHaveBeenCalled();
  });

  it('runs safely in an editor with no Spotlight', () => {
    const { result, main } = setup({ canvasTool: 'spotlight', spotlight: undefined });
    expect(() => result.current.onPointerDownCapture(press({ target: main }))).not.toThrow();
    expect(() => result.current.onContextMenuCapture(click())).not.toThrow();
  });

  it('starts an erase on a primary press with the Eraser', () => {
    const onEraseStart = vi.fn();
    const { result, main } = setup({ canvasTool: 'eraser', onEraseStart });
    result.current.onPointerDownCapture(press({ target: main }));
    expect(onEraseStart).toHaveBeenCalledWith(50, 60);
    const bare = setup({ canvasTool: 'eraser' });
    expect(() =>
      bare.result.current.onPointerDownCapture(press({ target: bare.main })),
    ).not.toThrow();
  });

  it('pans on a middle press, unless Settings leaves the button to the browser', () => {
    const { result, main, args } = setup();
    result.current.onPointerDownCapture(press({ target: main, button: 1 }));
    expect(args.setPan).toHaveBeenCalledWith(
      expect.objectContaining({ startClientX: 50, startOffsetX: 3, startOffsetY: 4 }),
    );
    const off = setup({ middleMousePan: false });
    off.result.current.onPointerDownCapture(press({ target: off.main, button: 1 }));
    expect(off.args.setPan).not.toHaveBeenCalled();
  });

  it('starts a queued draw over anything, and lets it fall through when it does not claim the press', () => {
    const { result, main } = setup({ pendingDraw: {} });
    const claimed = press({ target: main });
    result.current.onPointerDownCapture(claimed);
    expect(claimed.stopPropagation).toHaveBeenCalled();
    const declined = setup({ pendingDraw: {}, beginPendingDrawGesture: () => false });
    const fell = press({ target: declined.main });
    declined.result.current.onPointerDownCapture(fell);
    expect(fell.stopPropagation).not.toHaveBeenCalled();
    const none = setup({ pendingDraw: {}, beginPendingDrawGesture: undefined });
    const plain = press({ target: none.main });
    none.result.current.onPointerDownCapture(plain);
    expect(plain.stopPropagation).not.toHaveBeenCalled();
  });

  it('starts nothing for a plain press with no tool armed, and none without a surface', () => {
    const { result, main, args } = setup({ mainRef: null });
    result.current.onPointerDownCapture(press({ target: main }));
    expect(args.setPan).not.toHaveBeenCalled();
    expect(args.setMarquee).not.toHaveBeenCalled();
  });
});

describe('the context menu', () => {
  it('shrinks the Spotlight on a right-click and opens no menu in it', () => {
    const { result, args, calls } = setup({ canvasTool: 'spotlight' });
    const e = click();
    result.current.onContextMenuCapture(e);
    expect(args.spotlight!.shrink).toHaveBeenCalled();
    result.current.onContextMenu(click());
    result.current.onContextMenuPointerUp(press({ button: 2 }));
    expect(calls).toEqual([]);
  });

  it('leaves a right-click alone in the other tools', () => {
    const { result, args } = setup();
    const e = click();
    result.current.onContextMenuCapture(e);
    expect(e.stopPropagation).not.toHaveBeenCalled();
    expect(args.spotlight!.shrink).not.toHaveBeenCalled();
  });

  it('drops the press gesture, deselects, then opens the canvas menu', () => {
    const { result, args, calls } = setup();
    result.current.onContextMenuPointerUp(press({ button: 2 }));
    result.current.onContextMenu(click());
    expect(args.setMarquee).toHaveBeenCalledWith(null);
    expect(args.setPan).toHaveBeenCalledWith(null);
    expect(calls).toEqual(['deselect', 'menu']);
  });

  it('only deselects where there is no menu to open', () => {
    const { result, calls } = setup({ onCanvasContextMenu: undefined });
    result.current.onContextMenuPointerUp(press({ button: 2 }));
    result.current.onContextMenu(click());
    expect(calls).toEqual(['deselect']);
  });

  it('opens on a long press on touch', () => {
    vi.useFakeTimers();
    const { result, main, calls } = setup();
    act(() =>
      result.current.onPointerDown(
        press({ pointerType: 'touch', target: main, currentTarget: main }),
      ),
    );
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(calls).toEqual(['deselect', 'menu']);
  });
});

describe('the bubble-phase press on <main>', () => {
  it('pans through an element, with its tap', () => {
    const { result, args, main } = setup();
    const e = press({
      pointerType: 'touch',
      target: document.createElement('div'),
      currentTarget: main,
    });
    const onTap = vi.fn();
    markPanThrough(e, onTap);
    result.current.onPointerDown(e);
    expect(args.setPan).toHaveBeenCalledWith(expect.objectContaining({ onTap }));
    expect(args.setMarquee).not.toHaveBeenCalled();
  });

  it('pans through without a tap', () => {
    const { result, args, main } = setup();
    const e = press({
      pointerType: 'touch',
      target: document.createElement('div'),
      currentTarget: main,
    });
    markPanThrough(e);
    result.current.onPointerDown(e);
    expect(args.setPan).toHaveBeenCalledWith(
      expect.not.objectContaining({ onTap: expect.anything() }),
    );
  });

  it('arms nothing for a secondary button', () => {
    const { result, args, main } = setup();
    result.current.onPointerDown(press({ button: 2, target: main, currentTarget: main }));
    expect(args.setMarquee).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(main);
  });

  it('starts a marquee with Select, and a pan with Pan, Laser or Space', () => {
    const select = setup();
    select.result.current.onPointerDown(press({ target: select.main, currentTarget: select.main }));
    expect(select.args.setMarquee).toHaveBeenCalledWith({
      startX: 50,
      startY: 60,
      currentX: 50,
      currentY: 60,
    });
    expect(document.activeElement).toBe(select.main);
    for (const over of [
      { canvasTool: 'pan' },
      { canvasTool: 'laser' },
      { spaceHeldRef: { current: true } },
    ]) {
      const s = setup(over);
      s.result.current.onPointerDown(press({ target: s.main, currentTarget: s.main }));
      expect(s.args.setPan).toHaveBeenCalled();
    }
  });

  it('leaves a finger with the Laser to draw it', () => {
    const { result, args, main } = setup({ canvasTool: 'laser' });
    result.current.onPointerDown(
      press({ pointerType: 'touch', target: main, currentTarget: main }),
    );
    expect(args.setPan).not.toHaveBeenCalled();
    expect(args.setMarquee).not.toHaveBeenCalled();
  });

  it('starts a queued draw, except on the corner cluster', () => {
    const { result, args, main } = setup({ pendingDraw: {} });
    result.current.onPointerDown(press({ target: main, currentTarget: main }));
    expect(args.beginPendingDrawGesture).toHaveBeenCalledTimes(1);
    expect(args.setMarquee).not.toHaveBeenCalled();
    const cluster = document.createElement('div');
    cluster.setAttribute('data-zoom-cluster', '');
    main.append(cluster);
    result.current.onPointerDown(press({ target: cluster, currentTarget: main }));
    expect(args.beginPendingDrawGesture).toHaveBeenCalledTimes(1);
    const none = setup({ pendingDraw: {}, beginPendingDrawGesture: undefined });
    none.result.current.onPointerDown(press({ target: none.main, currentTarget: none.main }));
    expect(none.args.setMarquee).toHaveBeenCalled();
  });

  it('leaves a press that bubbled from an element alone', () => {
    const { result, args, main } = setup();
    result.current.onPointerDown(
      press({ target: document.createElement('div'), currentTarget: main }),
    );
    expect(args.setMarquee).not.toHaveBeenCalled();
  });

  it('ignores a portal press only where the editor asks', () => {
    const portal = document.createElement('button');
    const asked = setup({}, { ignorePortalPresses: true });
    document.body.append(portal);
    portal.focus();
    asked.result.current.onPointerDown(press({ target: portal, currentTarget: asked.main }));
    expect(document.activeElement).toBe(portal);
    const plain = setup();
    plain.result.current.onPointerDown(press({ target: portal, currentTarget: plain.main }));
    expect(document.activeElement).toBe(plain.main);
    const inside = setup({}, { ignorePortalPresses: true });
    inside.result.current.onPointerDown(press({ target: inside.main, currentTarget: inside.main }));
    expect(inside.args.setMarquee).toHaveBeenCalled();
  });
});

describe('the wrapper press', () => {
  it('routes only a primary press on the wrapper itself', () => {
    const { result, args, wrapper } = setup();
    result.current.onWrapperPointerDown(
      press({ target: document.createElement('div'), currentTarget: wrapper }),
    );
    result.current.onWrapperPointerDown(
      press({ button: 2, target: wrapper, currentTarget: wrapper }),
    );
    expect(args.setMarquee).not.toHaveBeenCalled();
    result.current.onWrapperPointerDown(press({ target: wrapper, currentTarget: wrapper }));
    expect(args.setMarquee).toHaveBeenCalled();
  });

  it('starts a queued draw first, and falls through when it declines', () => {
    const { result, args, wrapper } = setup({ pendingDraw: {} });
    result.current.onWrapperPointerDown(press({ target: wrapper, currentTarget: wrapper }));
    expect(args.setMarquee).not.toHaveBeenCalled();
    const none = setup({ pendingDraw: {}, beginPendingDrawGesture: undefined });
    none.result.current.onWrapperPointerDown(
      press({ target: none.wrapper, currentTarget: none.wrapper }),
    );
    expect(none.args.setMarquee).toHaveBeenCalled();
  });
});

describe('a double press', () => {
  const dbl = (target: Element, currentTarget: Element) =>
    ({ target, currentTarget, clientX: 110, clientY: 220 }) as unknown as ReactMouseEvent;

  it("says on the wrapper whether it was a finger's, at the canvas point", () => {
    const { result, args, main, wrapper } = setup();
    result.current.onWrapperDoubleClick(dbl(wrapper, wrapper));
    expect(args.onCanvasDoubleClick).toHaveBeenLastCalledWith(50, 100, false);
    result.current.onPointerDownCapture(press({ pointerType: 'touch', target: main }));
    expect(result.current.pressedByFinger()).toBe(true);
    result.current.onWrapperDoubleClick(dbl(wrapper, wrapper));
    expect(args.onCanvasDoubleClick).toHaveBeenLastCalledWith(50, 100, true);
    result.current.onWrapperDoubleClick(dbl(document.createElement('div'), wrapper));
    expect(args.onCanvasDoubleClick).toHaveBeenCalledTimes(2);
  });

  it('zooms on the bare surface only for a finger, and not in the Spotlight', () => {
    const { result, args, main } = setup();
    result.current.onSurfaceDoubleClick(dbl(main, main));
    expect(args.onCanvasDoubleClick).not.toHaveBeenCalled();
    result.current.onPointerDownCapture(press({ pointerType: 'touch', target: main }));
    result.current.onSurfaceDoubleClick(dbl(document.createElement('div'), main));
    expect(args.onCanvasDoubleClick).not.toHaveBeenCalled();
    result.current.onSurfaceDoubleClick(dbl(main, main));
    expect(args.onCanvasDoubleClick).toHaveBeenCalledWith(50, 100, true);
    const spot = setup({ canvasTool: 'spotlight' });
    spot.result.current.onPointerDownCapture(
      press({ pointerType: 'touch', target: spot.main, button: 1 }),
    );
    spot.result.current.onSurfaceDoubleClick(dbl(spot.main, spot.main));
    expect(spot.args.onCanvasDoubleClick).not.toHaveBeenCalled();
  });

  it('does nothing without a wrapper to measure', () => {
    const { result, args, main } = setup({ wrapperRef: { current: null } });
    result.current.onPointerDownCapture(press({ pointerType: 'touch', target: main }));
    result.current.onWrapperDoubleClick(dbl(main, main));
    result.current.onSurfaceDoubleClick(dbl(main, main));
    expect(args.onCanvasDoubleClick).not.toHaveBeenCalled();
  });
});

describe('useFocusCanvasOnMount', () => {
  it('focuses the canvas surface once mounted, and copes with no surface', () => {
    const main = document.createElement('main');
    main.tabIndex = -1;
    document.body.append(main);
    renderHook(() => useFocusCanvasOnMount({ current: main }));
    expect(document.activeElement).toBe(main);
    expect(() => renderHook(() => useFocusCanvasOnMount(null))).not.toThrow();
  });
});
