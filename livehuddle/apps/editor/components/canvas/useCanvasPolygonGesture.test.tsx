// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PendingDraw } from '@/lib/draw-mode';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasPolygonGesture } from './useCanvasPolygonGesture';

// The polygon tool (docs/specs/008-canvas/polygon-tool.md): clicks place vertices, Enter finishes the
// open line, Backspace takes one back, Escape clears them and stays armed, and disarming clears all.

const POLYGON = { type: 'polygon' } as PendingDraw;

type Props = { pendingDraw: PendingDraw | null; onCommitPolygon: CanvasProps['onCommitPolygon'] };

function setup(onCommitPolygon: CanvasProps['onCommitPolygon'] = vi.fn()) {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;
  return renderHook(
    (p: Props) =>
      useCanvasPolygonGesture({
        pendingDraw: p.pendingDraw,
        elements: [],
        wrapperRef: { current: wrapper },
        viewportZoom: 1,
        onCommitPolygon: p.onCommitPolygon,
      }),
    { initialProps: { pendingDraw: POLYGON as PendingDraw | null, onCommitPolygon } },
  );
}

const click = (result: ReturnType<typeof setup>['result'], x: number, y: number) =>
  act(() => {
    result.current.beginPolygonPoint({ clientX: x, clientY: y } as React.PointerEvent);
  });
const key = (k: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
  });

describe('useCanvasPolygonGesture', () => {
  it('finishes the open line on Enter, through the newest commit handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = setup(first);
    click(result, 0, 0);
    click(result, 100, 0);
    rerender({ pendingDraw: POLYGON, onCommitPolygon: second });
    key('Enter');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      false,
    );
    expect(result.current.polygonVertices).toEqual([]);
  });

  it('takes the last vertex back on Backspace', () => {
    const { result } = setup();
    click(result, 0, 0);
    click(result, 100, 0);
    key('Backspace');
    expect(result.current.polygonVertices).toEqual([{ x: 0, y: 0 }]);
  });

  it('clears the vertices on Escape and stays armed', () => {
    const { result } = setup();
    click(result, 0, 0);
    key('Escape');
    expect(result.current.polygonVertices).toEqual([]);
    click(result, 50, 50);
    expect(result.current.polygonVertices).toEqual([{ x: 50, y: 50 }]);
  });

  it('keeps every corner of clicks that land before a render', () => {
    const { result } = setup();
    // Three presses in one act: no render commits between them, as with fast clicks inside one frame.
    act(() => {
      const press = result.current.beginPolygonPoint;
      press({ clientX: 0, clientY: 0 } as React.PointerEvent);
      press({ clientX: 100, clientY: 0 } as React.PointerEvent);
      press({ clientX: 100, clientY: 100 } as React.PointerEvent);
    });
    expect(result.current.polygonVertices).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('starts afresh after disarming and arming again', () => {
    const { result, rerender } = setup();
    click(result, 0, 0);
    rerender({ pendingDraw: null, onCommitPolygon: vi.fn() });
    rerender({ pendingDraw: POLYGON, onCommitPolygon: vi.fn() });
    click(result, 50, 50);
    expect(result.current.polygonVertices).toEqual([{ x: 50, y: 50 }]);
  });

  it('clears the gesture when the tool disarms', () => {
    const { result, rerender } = setup();
    click(result, 0, 0);
    click(result, 100, 0);
    rerender({ pendingDraw: null, onCommitPolygon: vi.fn() });
    expect(result.current.polygonVertices).toEqual([]);
    expect(result.current.polygonCursor).toBeNull();
  });

  it('leaves the keys alone while disarmed', () => {
    const onCommitPolygon = vi.fn();
    const { rerender } = setup(onCommitPolygon);
    rerender({ pendingDraw: null, onCommitPolygon });
    key('Enter');
    expect(onCommitPolygon).not.toHaveBeenCalled();
  });
});

// The Room Builder (docs/specs/009-elements/room-builder.md) rides the same gesture: corners at 45 degrees,
// and every finish closes the room.
describe('useCanvasPolygonGesture, Room Builder', () => {
  const ROOM = { type: 'room-walls' } as PendingDraw;

  function room(onCommitRoomWalls = vi.fn(), onCommitPolygon = vi.fn()) {
    const wrapper = document.createElement('div');
    wrapper.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;
    const hook = renderHook(() =>
      useCanvasPolygonGesture({
        pendingDraw: ROOM,
        elements: [],
        wrapperRef: { current: wrapper },
        viewportZoom: 1,
        onCommitPolygon,
        onCommitRoomWalls,
      }),
    );
    return { ...hook, onCommitRoomWalls, onCommitPolygon };
  }
  const press = (
    result: ReturnType<typeof room>['result'],
    x: number,
    y: number,
    mods: { metaKey?: boolean; ctrlKey?: boolean } = {},
  ) =>
    act(() => {
      result.current.beginPolygonPoint({ clientX: x, clientY: y, ...mods } as React.PointerEvent);
    });

  it('snaps each corner after the first to 45 degrees from the last', () => {
    const { result } = room();
    press(result, 100, 100);
    press(result, 300, 112);
    press(result, 390, 190);
    const [, second, third] = result.current.polygonVertices;
    expect(second).toEqual({ x: 300, y: 100 });
    expect(third!.x - 300).toBeCloseTo(third!.y - 100);
  });

  it('places a corner freely with Cmd or Ctrl held', () => {
    const { result } = room();
    press(result, 100, 100);
    press(result, 300, 112, { metaKey: true });
    press(result, 320, 180, { ctrlKey: true });
    expect(result.current.polygonVertices.slice(1)).toEqual([
      { x: 300, y: 112 },
      { x: 320, y: 180 },
    ]);
  });

  it('closes the room on its first corner, never committing a polygon', () => {
    const { result, onCommitRoomWalls, onCommitPolygon } = room();
    press(result, 100, 100);
    press(result, 300, 100);
    press(result, 300, 300);
    press(result, 104, 104);
    expect(onCommitRoomWalls).toHaveBeenCalledWith([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 },
    ]);
    expect(onCommitPolygon).not.toHaveBeenCalled();
    expect(result.current.polygonVertices).toEqual([]);
  });

  it('closes on Enter or double-click only from three corners', () => {
    const { result, onCommitRoomWalls } = room();
    press(result, 100, 100);
    press(result, 300, 100);
    key('Enter');
    act(() => {
      result.current.handlePolygonDoubleClick();
    });
    expect(onCommitRoomWalls).not.toHaveBeenCalled();
    press(result, 300, 300);
    key('Enter');
    expect(onCommitRoomWalls).toHaveBeenCalledTimes(1);
    press(result, 0, 0);
    press(result, 200, 0);
    press(result, 200, 200);
    act(() => {
      result.current.handlePolygonDoubleClick();
    });
    expect(onCommitRoomWalls).toHaveBeenCalledTimes(2);
  });
});
