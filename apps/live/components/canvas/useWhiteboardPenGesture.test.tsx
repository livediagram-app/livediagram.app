// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { canvasGestureNow, resetCanvasGesturesForTests } from '@/lib/canvas-gesture';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { track } from '@/lib/telemetry';
import { useWhiteboardPenGesture } from './useWhiteboardPenGesture';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// The whiteboard pen gesture (docs/specs/023-draw-mode/draw-mode.md "Pens", "Touch and pen input";
// blueprint whiteboard-round-one "Pen ink").

const PEN: PendingDraw = {
  type: 'freehand',
  variant: 'whiteboard',
  colour: null,
  width: 1.5,
  recognise: false,
};

type Init = { x: number; y: number; id?: number; pressure?: number; shift?: boolean };

/** A pointer event as the browser sends it: position, pointer id, pressure, Shift. */
function pointer(type: string, { x, y, id = 1, pressure, shift = false }: Init): Event {
  const e = new MouseEvent(type, { clientX: x, clientY: y, shiftKey: shift });
  Object.defineProperty(e, 'pointerId', { value: id });
  if (pressure !== undefined) Object.defineProperty(e, 'pressure', { value: pressure });
  return e;
}

function setup(zoom = 1) {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () => ({ left: 10, top: 20 }) as DOMRect;
  const isPinchingRef = { current: false };
  const onCommitFreehand = vi.fn();
  let renders = 0;
  const hook = renderHook(
    (p: { pendingDraw: PendingDraw | null }) => {
      renders++;
      return useWhiteboardPenGesture({
        pendingDraw: p.pendingDraw,
        wrapperRef: { current: wrapper },
        viewportZoom: zoom,
        isPinchingRef,
        onCommitFreehand,
      });
    },
    { initialProps: { pendingDraw: PEN as PendingDraw | null } },
  );
  const press = (x: number, y: number, pointerType = 'mouse', pressure = 0.5) =>
    act(() => {
      hook.result.current.beginWhiteboardStroke(
        { pointerType, pointerId: 1, pressure } as ReactPointerEvent,
        { x: (x - 10) / zoom, y: (y - 20) / zoom },
      );
    });
  const send = (e: Event) =>
    act(() => {
      window.dispatchEvent(e);
    });
  return { hook, press, send, isPinchingRef, onCommitFreehand, renders: () => renders };
}

afterEach(() => vi.restoreAllMocks());

describe('useWhiteboardPenGesture', () => {
  it('commits exactly the raw samples the stroke showed, in canvas px, with its streamline', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const s = setup(2);
    s.press(10, 20);
    const stroke = s.hook.result.current.penStroke!;
    for (let i = 1; i <= 20; i++) s.send(pointer('pointermove', { x: 10 + i * 6, y: 20 + i }));
    const shown = stroke.points.slice();
    s.send(pointer('pointerup', { x: 130, y: 40 }));
    expect(s.onCommitFreehand).toHaveBeenCalledTimes(1);
    const [points, recognise, ink] = s.onCommitFreehand.mock.calls[0]!;
    expect(recognise).toBe(false);
    expect(points).toEqual(shown);
    expect(points).toHaveLength(21);
    // Canvas px: the wrapper sits at (10, 20) and the zoom is 2.
    expect(points[20]).toEqual({ x: 60, y: 10 });
    expect(ink).toEqual({ streamline: 0.5 });
    expect(s.hook.result.current.penStroke).toBeNull();
  });

  it('records a pen\u2019s pressure with every sample', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20, 'pen', 0.3);
    s.send(pointer('pointermove', { x: 20, y: 20, pressure: 0.6 }));
    s.send(pointer('pointermove', { x: 30, y: 20, pressure: 0.9 }));
    // A lifted pen reports no pressure: the lift point keeps the last one.
    s.send(pointer('pointerup', { x: 40, y: 20, pressure: 0 }));
    const [points, , ink] = s.onCommitFreehand.mock.calls[0]!;
    expect(points).toHaveLength(4);
    expect(ink).toEqual({ pressures: [0.3, 0.6, 0.9, 0.9], streamline: 0.2 });
  });

  it('renders nothing per sample: the stroke is drawn outside React', () => {
    const s = setup();
    s.press(10, 20);
    const before = s.renders();
    for (let i = 1; i <= 10; i++) s.send(pointer('pointermove', { x: 10 + i * 5, y: 20 }));
    expect(s.renders()).toBe(before);
    expect(s.hook.result.current.penStroke!.points).toHaveLength(11);
  });

  it('adds nothing on release when the pen lifts where it last was', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 30, y: 20 }));
    s.send(pointer('pointerup', { x: 30, y: 20 }));
    expect(s.onCommitFreehand.mock.calls[0]![0]).toHaveLength(2);
  });

  // docs/specs/023-draw-mode/draw-mode.md "Pens": a tap with a pen leaves a dot.
  it('commits a tap, a press lifted where it went down, as a one-point stroke', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const s = setup();
    s.press(40, 60, 'pen', 0.7);
    s.send(pointer('pointerup', { x: 40, y: 60 }));
    expect(s.onCommitFreehand).toHaveBeenCalledTimes(1);
    const [points, , ink] = s.onCommitFreehand.mock.calls[0]!;
    expect(points).toEqual([{ x: 30, y: 40 }]);
    expect(ink.pressures).toHaveLength(1);
  });

  it('ignores another pointer: a second finger neither draws nor ends the stroke', () => {
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 30, y: 20 }));
    s.send(pointer('pointermove', { x: 300, y: 300, id: 2 }));
    s.send(pointer('pointerup', { x: 300, y: 300, id: 2 }));
    expect(s.onCommitFreehand).not.toHaveBeenCalled();
    expect(s.hook.result.current.penStroke!.points).toHaveLength(2);
  });

  it('discards a stroke the browser cancels', () => {
    const debug = vi.spyOn(console, 'info').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 30, y: 20 }));
    s.send(pointer('pointercancel', { x: 30, y: 20 }));
    s.send(pointer('pointerup', { x: 30, y: 20 }));
    expect(s.onCommitFreehand).not.toHaveBeenCalled();
    expect(s.hook.result.current.penStroke).toBeNull();
    expect(debug).toHaveBeenCalledWith('[whiteboard] stroke discarded: cancel');
  });

  it('discards a stroke a second finger turned into a pinch', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 30, y: 20 }));
    s.isPinchingRef.current = true;
    s.send(pointer('pointermove', { x: 50, y: 20 }));
    s.send(pointer('pointerup', { x: 50, y: 20 }));
    expect(s.onCommitFreehand).not.toHaveBeenCalled();
  });

  it('drops the stroke when the pen is put down mid-stroke (Escape)', () => {
    const debug = vi.spyOn(console, 'info').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 30, y: 20 }));
    s.hook.rerender({ pendingDraw: null });
    expect(s.hook.result.current.penStroke).toBeNull();
    s.send(pointer('pointerup', { x: 30, y: 20 }));
    expect(s.onCommitFreehand).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledWith('[whiteboard] stroke discarded: pen put down');
  });

  it('logs each committed stroke with its pointer, samples and pressure', () => {
    const debug = vi.spyOn(console, 'info').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20, 'pen', 0.4);
    s.send(pointer('pointermove', { x: 20, y: 20, pressure: 0.5 }));
    s.send(pointer('pointermove', { x: 30, y: 20, pressure: 0.5 }));
    s.send(pointer('pointerup', { x: 30, y: 20 }));
    expect(debug).toHaveBeenCalledWith('[whiteboard] stroke pen samples=3 pressure=yes');
  });

  // docs/specs/023-draw-mode/draw-mode.md "Shape recognition": Shift while reshaping.
  describe('with Shift while reshaping a locked shape', () => {
    const circle = {
      kind: 'circle' as const,
      bbox: { x: 0, y: 0, width: 100, height: 60 },
      confidence: 1,
    };
    // Canvas px = client px - (10, 20) at zoom 1.
    const locked = () => {
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const s = setup();
      s.press(110, 80);
      const stroke = s.hook.result.current.penStroke!;
      stroke.snapTo(circle);
      const notified = vi.fn();
      stroke.subscribe(notified);
      return { ...s, stroke, notified };
    };

    it('commits the shape perfect, exactly as it showed', () => {
      const s = locked();
      s.send(pointer('pointermove', { x: 160, y: 90, shift: true }));
      const shown = s.stroke.shaped();
      expect(shown!.bbox).toEqual({ x: 0, y: 0, width: 150, height: 150 });
      s.send(pointer('pointerup', { x: 160, y: 90, shift: true }));
      expect(s.onCommitFreehand.mock.calls[0]![2].snapped).toEqual(shown);
    });

    it('lets it free again on the next move once Shift is released', () => {
      const s = locked();
      s.send(pointer('pointermove', { x: 160, y: 90, shift: true }));
      s.send(pointer('pointermove', { x: 161, y: 90 }));
      s.send(pointer('pointerup', { x: 161, y: 90 }));
      expect(s.onCommitFreehand.mock.calls[0]![2].snapped.bbox).toEqual({
        x: 0,
        y: 0,
        width: 151,
        height: 70,
      });
    });

    it('redraws on a move that only changes Shift', () => {
      const s = locked();
      s.send(pointer('pointermove', { x: 160, y: 90 }));
      expect(s.notified).toHaveBeenCalledTimes(1);
      s.send(pointer('pointermove', { x: 160, y: 90, shift: true }));
      expect(s.notified).toHaveBeenCalledTimes(2);
      expect(s.stroke.shaped()!.bbox.width).toBe(150);
      expect(s.stroke.shaped()!.bbox.height).toBe(150);
      s.send(pointer('pointermove', { x: 160, y: 90, shift: true }));
      expect(s.notified).toHaveBeenCalledTimes(2);
    });

    it('lands what showed even when Shift changes on the lift itself', () => {
      const s = locked();
      s.send(pointer('pointermove', { x: 160, y: 90 }));
      const shown = s.stroke.shaped();
      s.send(pointer('pointerup', { x: 160, y: 90, shift: true }));
      expect(s.onCommitFreehand.mock.calls[0]![2].snapped).toEqual(shown);
    });

    it('commits a drawn rectangle as a clean 5:3, measured as Shift is pressed', () => {
      const s = locked();
      s.stroke.snapTo({ ...circle, kind: 'square' });
      s.send(pointer('pointermove', { x: 160, y: 90, shift: true }));
      s.send(pointer('pointerup', { x: 160, y: 90, shift: true }));
      const landed = s.onCommitFreehand.mock.calls[0]![2].snapped;
      expect(landed.kind).toBe('square');
      expect(landed.bbox.width).toBe(150);
      expect(landed.bbox.height).toBeCloseTo(90, 9);
    });

    it('takes Shift held on the press as held from the start', () => {
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const s = setup();
      act(() => {
        s.hook.result.current.beginWhiteboardStroke(
          {
            pointerType: 'mouse',
            pointerId: 1,
            pressure: 0.5,
            shiftKey: true,
          } as ReactPointerEvent,
          { x: 100, y: 60 },
        );
      });
      const stroke = s.hook.result.current.penStroke!;
      stroke.snapTo(circle);
      expect(stroke.shaped()!.bbox).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    });
  });
});

// docs/specs/023-draw-mode/draw-mode.md "Shape recognition": Alt (Option) flips the stroke.
describe('useWhiteboardPenGesture, with Alt', () => {
  /** A key event as the browser sends it; `defaultPrevented` says whether the page kept it. */
  const key = (type: 'keydown' | 'keyup', k = 'Alt', repeat = false) =>
    new KeyboardEvent(type, { key: k, repeat, cancelable: true, altKey: type === 'keydown' });
  /** A square drawn from client (10, 20), canvas (0, 0): 200 canvas px a side. */
  const drawSquare = (s: ReturnType<typeof setup>) => {
    s.press(10, 20);
    const side = (i: number) => i * 10;
    for (let i = 1; i <= 20; i++) s.send(pointer('pointermove', { x: 10 + side(i), y: 20 }));
    for (let i = 1; i <= 20; i++) s.send(pointer('pointermove', { x: 210, y: 20 + side(i) }));
    for (let i = 1; i <= 20; i++) s.send(pointer('pointermove', { x: 210 - side(i), y: 220 }));
    for (let i = 1; i <= 19; i++) s.send(pointer('pointermove', { x: 10, y: 220 - side(i) }));
    return s.hook.result.current.penStroke!;
  };

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.mocked(track).mockClear();
  });

  it('recognises the stroke at once with recognition off, and it lands as the shape', () => {
    const s = setup();
    const stroke = drawSquare(s);
    const down = key('keydown');
    s.send(down);
    expect(down.defaultPrevented).toBe(true);
    expect(stroke.shaped()?.kind).toBe('square');
    expect(track).toHaveBeenCalledWith('Draw', 'Toggled', 'RecogniseOnceKey');
    const up = key('keyup');
    s.send(up);
    expect(up.defaultPrevented).toBe(true);
    // Releasing Alt changes nothing.
    expect(stroke.shaped()?.kind).toBe('square');
    s.send(pointer('pointerup', { x: 10, y: 30 }));
    const [, , ink] = s.onCommitFreehand.mock.calls[0]!;
    expect(ink.snapped.kind).toBe('square');
    expect(ink.keepInk).toBeUndefined();
  });

  it('breaks a shown shape back to ink, held while Alt is, and it lands as ink', () => {
    const s = setup();
    const stroke = drawSquare(s);
    s.send(key('keydown'));
    s.send(key('keyup'));
    s.send(key('keydown'));
    expect(stroke.shaped()).toBeNull();
    expect(stroke.inkHeld()).toBe(true);
    expect(track).toHaveBeenLastCalledWith('Draw', 'Toggled', 'BreakShapeKey');
    s.send(key('keyup'));
    expect(stroke.inkHeld()).toBe(false);
    s.send(pointer('pointerup', { x: 10, y: 30 }));
    const [, , ink] = s.onCommitFreehand.mock.calls[0]!;
    expect(ink.snapped).toBeUndefined();
    expect(ink.keepInk).toBe(true);
  });

  it('holds the ink from any Alt press, so the dwell does not snap while it is down', () => {
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 40, y: 50 }));
    const stroke = s.hook.result.current.penStroke!;
    s.send(key('keydown'));
    expect(stroke.inkHeld()).toBe(true);
    // A window losing focus never leaves Alt stuck down.
    s.send(new FocusEvent('blur'));
    expect(stroke.inkHeld()).toBe(false);
  });

  it('flips once per press: a held key repeating changes nothing', () => {
    const s = setup();
    const stroke = drawSquare(s);
    s.send(key('keydown'));
    const repeat = key('keydown', 'Alt', true);
    s.send(repeat);
    expect(repeat.defaultPrevented).toBe(true);
    expect(stroke.shaped()?.kind).toBe('square');
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('keeps the browser menu shut when Alt is released after the lift', () => {
    const s = setup();
    drawSquare(s);
    s.send(key('keydown'));
    s.send(pointer('pointerup', { x: 10, y: 30 }));
    const up = key('keyup');
    s.send(up);
    expect(up.defaultPrevented).toBe(true);
    // Only that once: a later Alt is the browser's again.
    const later = key('keyup');
    s.send(later);
    expect(later.defaultPrevented).toBe(false);
  });

  it('leaves Alt alone when no stroke is being drawn', () => {
    const s = setup();
    const down = key('keydown');
    s.send(down);
    expect(down.defaultPrevented).toBe(false);
    expect(track).not.toHaveBeenCalled();
    expect(s.hook.result.current.penStroke).toBeNull();
  });

  it('ignores other keys', () => {
    const s = setup();
    const stroke = drawSquare(s);
    const down = key('keydown', 'a');
    s.send(down);
    expect(down.defaultPrevented).toBe(false);
    expect(stroke.shaped()).toBeNull();
  });
});

// docs/specs/008-canvas/canvas-performance.md: a pen stroke is a stroke gesture, however it ends.
describe('useWhiteboardPenGesture gesture', () => {
  afterEach(() => resetCanvasGesturesForTests());

  it('opens a stroke from the press to the lift', () => {
    const s = setup();
    s.press(10, 20);
    expect(canvasGestureNow()).toBe('stroke');
    s.send(pointer('pointerup', { x: 30, y: 20 }));
    expect(canvasGestureNow()).toBe('idle');
  });

  it('closes the stroke the browser cancels', () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointercancel', { x: 30, y: 20 }));
    expect(canvasGestureNow()).toBe('idle');
  });
});
