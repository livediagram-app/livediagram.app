// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PendingDraw } from '@/lib/draw-mode';
import { useWhiteboardPenGesture } from './useWhiteboardPenGesture';

// The whiteboard pen gesture (docs/specs/023-whiteboard/whiteboard.md "Pens", "Touch and pen input";
// blueprint whiteboard-round-one "Live stroke pipeline", Capture).

const PEN: PendingDraw = {
  type: 'freehand',
  variant: 'whiteboard',
  colour: null,
  width: 1.5,
  recognise: false,
};

type Init = { x: number; y: number; t: number; id?: number; coalesced?: Event[] };

/** A pointer event as the browser sends it: position, time, pointer id, coalesced samples. */
function pointer(type: string, { x, y, t, id = 1, coalesced }: Init): Event {
  const e = new MouseEvent(type, { clientX: x, clientY: y });
  Object.defineProperty(e, 'timeStamp', { value: t });
  Object.defineProperty(e, 'pointerId', { value: id });
  if (coalesced) Object.defineProperty(e, 'getCoalescedEvents', { value: () => coalesced });
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
  const press = (x: number, y: number, t = 0, pointerType = 'mouse') =>
    act(() => {
      hook.result.current.beginWhiteboardStroke(
        { pointerType, pointerId: 1, timeStamp: t } as ReactPointerEvent,
        { x: (x - 10) / zoom, y: (y - 20) / zoom },
      );
    });
  const send = (e: Event) =>
    act(() => {
      window.dispatchEvent(e);
    });
  return {
    hook,
    press,
    send,
    isPinchingRef,
    onCommitFreehand,
    renders: () => renders,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('useWhiteboardPenGesture', () => {
  it('commits exactly the points the stroke showed last, in canvas px', () => {
    const s = setup(2);
    s.press(10, 20);
    const stroke = s.hook.result.current.penStroke!;
    let shown: { x: number; y: number }[] = [];
    stroke.subscribe(() => {
      shown = [...stroke.smoother.kept, ...stroke.smoother.tail()];
    });
    for (let i = 1; i <= 30; i++) {
      s.send(pointer('pointermove', { x: 10 + i * 6, y: 20 + Math.sin(i / 3) * 20, t: i * 8 }));
    }
    s.send(pointer('pointerup', { x: 190, y: 20 + Math.sin(10) * 20, t: 245 }));
    expect(s.onCommitFreehand).toHaveBeenCalledTimes(1);
    const [points, recognise] = s.onCommitFreehand.mock.calls[0]!;
    expect(recognise).toBe(false);
    expect(points).toEqual(shown);
    // Canvas px: the wrapper sits at (10, 20) and the zoom is 2.
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1].x).toBe(90);
    expect(points[points.length - 1].y).toBeCloseTo((Math.sin(10) * 20) / 2, 9);
    expect(s.hook.result.current.penStroke).toBeNull();
  });

  it('takes every coalesced sample of a move', () => {
    const s = setup();
    s.press(10, 20);
    const coalesced = [
      pointer('pointermove', { x: 14, y: 20, t: 2 }),
      pointer('pointermove', { x: 18, y: 20, t: 4 }),
      pointer('pointermove', { x: 22, y: 20, t: 6 }),
    ];
    s.send(pointer('pointermove', { x: 22, y: 20, t: 6, coalesced }));
    expect(s.hook.result.current.penStroke!.smoother.sampleCount).toBe(4);
  });

  it('renders nothing per sample: the stroke is drawn outside React', () => {
    const s = setup();
    s.press(10, 20);
    const before = s.renders();
    for (let i = 1; i <= 10; i++)
      s.send(pointer('pointermove', { x: 10 + i * 5, y: 20, t: i * 8 }));
    expect(s.renders()).toBe(before);
  });

  it('adds where the pen lifted when it moved since the last sample', () => {
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 30, y: 20, t: 8 }));
    s.send(pointer('pointerup', { x: 50, y: 20, t: 16 }));
    const points = s.onCommitFreehand.mock.calls[0]![0] as { x: number; y: number }[];
    expect(points[points.length - 1]).toEqual({ x: 40, y: 0 });
  });

  it('ignores another pointer: a second finger neither draws nor ends the stroke', () => {
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 30, y: 20, t: 8 }));
    s.send(pointer('pointermove', { x: 300, y: 300, t: 9, id: 2 }));
    s.send(pointer('pointerup', { x: 300, y: 300, t: 10, id: 2 }));
    expect(s.onCommitFreehand).not.toHaveBeenCalled();
    expect(s.hook.result.current.penStroke!.smoother.sampleCount).toBe(2);
  });

  it('discards a stroke the browser cancels', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 30, y: 20, t: 8 }));
    s.send(pointer('pointercancel', { x: 30, y: 20, t: 9 }));
    s.send(pointer('pointerup', { x: 30, y: 20, t: 10 }));
    expect(s.onCommitFreehand).not.toHaveBeenCalled();
    expect(s.hook.result.current.penStroke).toBeNull();
    expect(debug).toHaveBeenCalledWith('[whiteboard] stroke discarded: cancel');
  });

  it('discards a stroke a second finger turned into a pinch', () => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 30, y: 20, t: 8 }));
    s.isPinchingRef.current = true;
    s.send(pointer('pointermove', { x: 50, y: 20, t: 16 }));
    s.send(pointer('pointerup', { x: 50, y: 20, t: 24 }));
    expect(s.onCommitFreehand).not.toHaveBeenCalled();
  });

  it('drops the stroke when the pen is put down mid-stroke (Escape)', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20);
    s.send(pointer('pointermove', { x: 30, y: 20, t: 8 }));
    s.hook.rerender({ pendingDraw: null });
    expect(s.hook.result.current.penStroke).toBeNull();
    s.send(pointer('pointerup', { x: 30, y: 20, t: 16 }));
    expect(s.onCommitFreehand).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledWith('[whiteboard] stroke discarded: pen put down');
  });

  it('logs each committed stroke with its pointer and counts', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const s = setup();
    s.press(10, 20, 0, 'pen');
    const coalesced = [
      pointer('pointermove', { x: 20, y: 20, t: 4 }),
      pointer('pointermove', { x: 30, y: 20, t: 8 }),
    ];
    s.send(pointer('pointermove', { x: 30, y: 20, t: 8, coalesced }));
    s.send(pointer('pointerup', { x: 30, y: 20, t: 12 }));
    expect(debug).toHaveBeenCalledWith('[whiteboard] stroke pen samples=3 coalesced=1 kept=2');
  });
});
