// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { LONG_PRESS_MS } from '@liveworkspace/workbench/hooks/ui/useLongPress';
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
      beginPendingDrawGesture: () => false,
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

  it.each(['avatar'])('never opens in the %s tool', (tool) => {
    const { result, onCanvasContextMenu } = setup(tool);
    result.current.onContextMenu(ctx(0));
    result.current.onContextMenu(ctx(2));
    result.current.onContextMenuPointerUp(up(2));
    expect(onCanvasContextMenu).not.toHaveBeenCalled();
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

  it.each(['avatar'])('keeps the selection in the %s tool', (tool) => {
    const { result, onDeselect } = setup(tool);
    result.current.onContextMenu(ctx(0));
    result.current.onContextMenu(ctx(2));
    result.current.onContextMenuPointerUp(up(2));
    expect(onDeselect).not.toHaveBeenCalled();
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

// docs/specs/008-canvas/canvas-and-palette.md "Touch (iOS / iPad)": a finger on an element too big for the screen pans
// the canvas.
describe('a press that pans through an element', () => {
  it('pans whatever the tool, from inside an element, and arms no menu', async () => {
    const { markPanThrough } = await import('@liveworkspace/workbench/hooks/canvas/pan-through');
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

// docs/specs/008-canvas/avatar-mode.md "Walking": a finger's drag pans, and only its tap walks.
describe('Avatar mode presses', () => {
  function avatarSetup(
    peerAvatars: unknown[] = [],
    {
      elements,
      onToggleDoor,
      onReadElement,
      feet = { x: 0, y: 0 },
    }: {
      elements?: unknown[];
      onToggleDoor?: (id: string) => boolean;
      feet?: { x: number; y: number };
      onReadElement?: (id: string) => void;
    } = {},
  ) {
    const walkTo = vi.fn();
    const onPushPeer = vi.fn();
    const setPan = vi.fn();
    const wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 800,
        x: 0,
        y: 0,
        width: 400,
        height: 800,
      }) as DOMRect;
    const { result } = renderHook(() =>
      useCanvasSurfaceGestures({
        canvasTool: 'avatar',
        middleMousePan: true,
        pendingDraw: null,
        viewportOffset: { x: 0, y: 0 },
        viewportZoom: 1,
        mainRef: { current: null },
        wrapperRef: { current: wrapper },
        spaceHeldRef: { current: false },
        setPan,
        setMarquee: vi.fn(),
        spotlight: {},
        avatar: { walkTo, pos: feet, seatedOn: null },
        peerAvatars,
        onPushPeer,
        elements,
        onToggleDoor,
        onReadElement,
        isoCamera: {},
        beginPendingDrawGesture: () => false,
        onDeselect: vi.fn(),
        onCanvasDoubleClick: vi.fn(),
      } as never),
    );
    const stopPropagation = vi.fn();
    const press = (pointerType: string, target: Element = document.createElement('div')) =>
      result.current.onPointerDownCapture({
        target,
        button: 0,
        detail: 1,
        clientX: 120,
        clientY: 240,
        pointerType,
        preventDefault: vi.fn(),
        stopPropagation,
      } as unknown as ReactPointerEvent);
    return { press, walkTo, setPan, onPushPeer, stopPropagation };
  }

  // A pressable face inside a box of the kind (docs/specs/008-canvas/avatar-mode.md "Clicking a piece").
  const faceOf = (kind: string) => {
    const box = document.createElement('div');
    box.setAttribute('data-element-kind', kind);
    const face = document.createElement('button');
    box.appendChild(face);
    return face;
  };

  it.each(['directory', 'elevator', 'stairs', 'notice-board', 'world-clock', 'portal'])(
    'opens a %s in place: no walk, and the press kept from the element',
    (kind) => {
      for (const pointer of ['mouse', 'touch']) {
        const { press, walkTo, setPan, stopPropagation } = avatarSetup();
        press(pointer, faceOf(kind));
        expect(walkTo).not.toHaveBeenCalled();
        expect(setPan).not.toHaveBeenCalled();
        expect(stopPropagation).toHaveBeenCalled();
      }
    },
  );

  // A door centred on the press point (120, 240), across a horizontal wall.
  const door = { id: 'door', type: 'shape', shape: 'door', x: 72, y: 228, width: 96, height: 24 };

  it('swings a door the character stands beside, and does not walk', () => {
    const onToggleDoor = vi.fn(() => true);
    const { press, walkTo } = avatarSetup([], {
      elements: [door],
      onToggleDoor,
      feet: { x: 120, y: 270 },
    });
    press('mouse');
    expect(onToggleDoor).toHaveBeenCalledWith('door');
    expect(walkTo).not.toHaveBeenCalled();
  });

  it('walks to the near side of a far door, swinging nothing', () => {
    const onToggleDoor = vi.fn(() => true);
    const { press, walkTo } = avatarSetup([], {
      elements: [door],
      onToggleDoor,
      feet: { x: 120, y: 700 },
    });
    press('mouse');
    expect(onToggleDoor).not.toHaveBeenCalled();
    const to = walkTo.mock.calls[0]?.[0] as { x: number; y: number };
    expect(to.x).toBeCloseTo(120);
    expect(to.y).toBeGreaterThan(240);
  });

  it('walks a Viewer, who may not swing it, even beside the door', () => {
    const onToggleDoor = vi.fn(() => false);
    const { press, walkTo } = avatarSetup([], {
      elements: [door],
      onToggleDoor,
      feet: { x: 120, y: 270 },
    });
    press('mouse');
    expect(onToggleDoor).toHaveBeenCalledWith('door');
    expect(walkTo).toHaveBeenCalledTimes(1);
  });

  // A piece covering the press point (120, 240): the layer is pointer-inert while walking, so the press lands on
  // the bare surface and the piece is found from its footprint (docs/specs/008-canvas/avatar-mode.md).
  const pieceAt = (type: string, shape?: string) => ({
    id: 'piece',
    type,
    ...(shape ? { shape } : {}),
    x: 60,
    y: 200,
    width: 120,
    height: 80,
  });

  it.each([
    'directory',
    'elevator',
    'stairs',
    'portal',
    'mode-button',
    'focus-button',
    'notice-board',
    'world-clock',
    'screen',
    'room-sign',
    'jukebox',
  ])(
    'a press on the middle of a %s face, off its buttons, presses its main action and never walks',
    (kind) => {
      const box = document.createElement('div');
      box.setAttribute('data-element-id', 'piece');
      const main = document.createElement('button');
      main.setAttribute('data-piece-main', '');
      const onMain = vi.fn();
      main.addEventListener('click', onMain);
      box.appendChild(main);
      document.body.appendChild(box);
      const onReadElement = vi.fn();
      const { press, walkTo } = avatarSetup([], {
        elements: [pieceAt('shape', 'room'), pieceAt('shape', kind)],
        onReadElement,
      });
      press('mouse');
      expect(walkTo).not.toHaveBeenCalled();
      expect(onMain).toHaveBeenCalledTimes(1);
      expect(onReadElement).not.toHaveBeenCalled();
      box.remove();
    },
  );

  it('opens a piece with no main action right now (an idle Screen) in the reader, never walking', () => {
    const onReadElement = vi.fn();
    const { press, walkTo } = avatarSetup([], {
      elements: [pieceAt('shape', 'screen')],
      onReadElement,
    });
    press('mouse');
    expect(onReadElement).toHaveBeenCalledWith('piece');
    expect(walkTo).not.toHaveBeenCalled();
  });

  // docs/specs/013-workspace/share-roles.md "Always walking": a control that is not yours to press (Bring Focus for a
  // Participant or a Viewer) is a sign: no reader, no walk.
  it.each(['focus-button', 'mode-button', 'timer', 'stopwatch'])(
    'does nothing on a %s with no main action of yours: no reader, no walk',
    (kind) => {
      const onReadElement = vi.fn();
      const { press, walkTo } = avatarSetup([], {
        elements: [pieceAt('shape', 'room'), pieceAt('shape', kind)],
        onReadElement,
      });
      press('mouse');
      expect(onReadElement).not.toHaveBeenCalled();
      expect(walkTo).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['sticky', undefined],
    ['text', undefined],
    ['image', undefined],
    ['table', undefined],
    ['shape', 'callout'],
    ['shape', 'bar-chart'],
  ])('opens a %s %s in the reader instead of walking', (type, shape) => {
    const onReadElement = vi.fn();
    const { press, walkTo } = avatarSetup([], { elements: [pieceAt(type, shape)], onReadElement });
    press('mouse');
    expect(onReadElement).toHaveBeenCalledWith('piece');
    expect(walkTo).not.toHaveBeenCalled();
  });

  it.each(['chair', 'room', 'tree', 'water-cooler', 'avatar-pad'])(
    'walks onto a %s under the press',
    (kind) => {
      const onReadElement = vi.fn();
      const { press, walkTo } = avatarSetup([], {
        elements: [pieceAt('shape', kind)],
        onReadElement,
      });
      press('mouse');
      expect(walkTo).toHaveBeenCalledWith({ x: 120, y: 240 });
      expect(onReadElement).not.toHaveBeenCalled();
    },
  );

  // docs/specs/009-elements/workday-pieces.md "Reception Desk": a click on the counter walks to its front, never behind.
  it.each(['arcade-machine', 'reception-desk'])(
    'walks to the front of a %s under the press',
    (kind) => {
      const { press, walkTo } = avatarSetup([], { elements: [pieceAt('shape', kind)] });
      press('mouse');
      expect(walkTo).toHaveBeenCalledWith({ x: 120, y: 296 });
    },
  );

  it.each(['avatar-pad', 'chair'])('walks to a %s it is pressed on', (kind) => {
    const { press, walkTo } = avatarSetup();
    press('mouse', faceOf(kind));
    expect(walkTo).toHaveBeenCalledWith({ x: 120, y: 240 });
  });

  it('pans on a finger, walking only when the press turns out a tap', () => {
    const { press, walkTo, setPan } = avatarSetup();
    press('touch');
    expect(walkTo).not.toHaveBeenCalled();
    const pan = setPan.mock.calls[0]?.[0] as { startClientX: number; onTap?: () => void };
    expect(pan.startClientX).toBe(120);
    pan.onTap?.();
    expect(walkTo).toHaveBeenCalledWith({ x: 120, y: 240 });
  });

  it('walks at once on a mouse click, starting no pan', () => {
    const { press, walkTo, setPan } = avatarSetup();
    press('mouse');
    expect(walkTo).toHaveBeenCalledWith({ x: 120, y: 240 });
    expect(setPan).not.toHaveBeenCalled();
  });

  // docs/specs/009-elements/chair.md "Sitting": a seated character cannot be pushed.
  const peerAt = (seatedOn: string | null) => ({
    id: 'peer',
    name: 'Ada',
    color: '#f00',
    glideMs: 0,
    avatar: {
      x: 120,
      y: 250,
      facing: 'down',
      walking: false,
      stepFrame: 0,
      lift: 0,
      wave: null,
      seatedOn,
    },
  });

  it('walks up to a standing peer and pushes them on arrival', () => {
    const { press, walkTo, onPushPeer } = avatarSetup([peerAt(null)]);
    press('mouse');
    const arrive = walkTo.mock.calls[0]?.[1] as (() => void) | undefined;
    arrive?.();
    expect(onPushPeer).toHaveBeenCalledWith('peer', expect.any(Number), expect.any(Number));
  });

  it('walks up to a seated peer and sends no push', () => {
    const { press, walkTo, onPushPeer } = avatarSetup([peerAt('chair')]);
    press('mouse');
    expect(walkTo).toHaveBeenCalledWith(
      expect.objectContaining({ x: expect.any(Number) }),
      undefined,
    );
    expect(onPushPeer).not.toHaveBeenCalled();
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Touch (iOS / iPad)": a press panning through an element hands its tap to the pan.
describe('a pan-through press with a tap', () => {
  it('carries the tap into the pan', async () => {
    const { markPanThrough } = await import('@liveworkspace/workbench/hooks/canvas/pan-through');
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
  const inertTool = () =>
    new Proxy({}, { get: (_, key) => (key === 'pos' ? { x: 0, y: 0 } : () => undefined) });
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
        pendingDraw: null,
        viewportOffset: { x: 0, y: 0 },
        viewportZoom: 2,
        mainRef: { current: null },
        wrapperRef: { current: wrapper },
        spaceHeldRef: { current: false },
        setPan: vi.fn(),
        setMarquee: vi.fn(),
        // The inert tools handle the press themselves; any of their calls is a no-op here.
        spotlight: inertTool(),
        avatar: inertTool(),
        peerAvatars: [],
        isoCamera: inertTool(),
        beginPendingDrawGesture: () => false,
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
    const { press, dblSurface, onCanvasDoubleClick } = dblSetup();
    press('touch');
    dblSurface();
    // Outside the wrapper's rect, by the same linear mapping.
    expect(onCanvasDoubleClick).toHaveBeenCalledWith(300, 0, true);
  });

  it('leaves the bare surface alone for a mouse, for anything on it, and in the inert tools', () => {
    const mouse = dblSetup();
    mouse.press('mouse');
    mouse.dblSurface();
    expect(mouse.onCanvasDoubleClick).not.toHaveBeenCalled();

    const child = dblSetup();
    child.press('touch');
    child.dblSurface(document.createElement('div'));
    expect(child.onCanvasDoubleClick).not.toHaveBeenCalled();

    for (const tool of ['avatar']) {
      const inert = dblSetup(tool);
      inert.press('touch');
      inert.dblSurface();
      expect(inert.onCanvasDoubleClick).not.toHaveBeenCalled();
    }
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
