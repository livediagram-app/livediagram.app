// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { useWhiteboardPenGesture } from './useWhiteboardPenGesture';

// The whiteboard pen gesture (docs/specs/023-whiteboard/whiteboard.md "Pens", "Touch and pen input";
// blueprint whiteboard-round-one "Pen ink").

const PEN: PendingDraw = {
  type: 'freehand',
  variant: 'whiteboard',
  colour: null,
  width: 1.5,
  recognise: false,
};

type Init = { x: number; y: number; id?: number; pressure?: number };

/** A pointer event as the browser sends it: position, pointer id, pressure. */
function pointer(type: string, { x, y, id = 1, pressure }: Init): Event {
  const e = new MouseEvent(type, { clientX: x, clientY: y });
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
    vi.spyOn(console, 'debug').mockImplementation(() => {});
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
    vi.spyOn(console, 'debug').mockImplementation(() => {});
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
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 30, y: 20 }));
    s.send(pointer('pointerup', { x: 30, y: 20 }));
    expect(s.onCommitFreehand.mock.calls[0]![0]).toHaveLength(2);
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
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
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
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 30, y: 20 }));
    s.isPinchingRef.current = true;
    s.send(pointer('pointermove', { x: 50, y: 20 }));
    s.send(pointer('pointerup', { x: 50, y: 20 }));
    expect(s.onCommitFreehand).not.toHaveBeenCalled();
  });

  it('drops the stroke when the pen is put down mid-stroke (Escape)', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
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
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20, 'pen', 0.4);
    s.send(pointer('pointermove', { x: 20, y: 20, pressure: 0.5 }));
    s.send(pointer('pointermove', { x: 30, y: 20, pressure: 0.5 }));
    s.send(pointer('pointerup', { x: 30, y: 20 }));
    expect(debug).toHaveBeenCalledWith('[whiteboard] stroke pen samples=3 pressure=yes');
  });
});
