// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PendingDraw } from '@/lib/draw-mode';
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useCanvasPolygonGesture } from './useCanvasPolygonGesture';

// The Room Builder (docs/specs/009-elements/room-builder.md): clicks place corners at 45 degrees, Enter or the
// first corner closes the room, Backspace takes one back, Escape clears them and stays armed, and disarming clears
// all.

const ROOM = { type: 'room-walls' } as PendingDraw;

type Props = {
  pendingDraw: PendingDraw | null;
  onCommitRoomWalls: CanvasProps['onCommitRoomWalls'];
};

function setup(onCommitRoomWalls: NonNullable<CanvasProps['onCommitRoomWalls']> = vi.fn()) {
  const wrapper = document.createElement('div');
  wrapper.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 }) as DOMRect;
  const hook = renderHook(
    (p: Props) =>
      useCanvasPolygonGesture({
        pendingDraw: p.pendingDraw,
        wrapperRef: { current: wrapper },
        viewportZoom: 1,
        onCommitRoomWalls: p.onCommitRoomWalls,
      }),
    { initialProps: { pendingDraw: ROOM as PendingDraw | null, onCommitRoomWalls } },
  );
  return { ...hook, onCommitRoomWalls };
}

const press = (
  result: ReturnType<typeof setup>['result'],
  x: number,
  y: number,
  mods: { metaKey?: boolean; ctrlKey?: boolean } = {},
) =>
  act(() => {
    result.current.beginPolygonPoint({ clientX: x, clientY: y, ...mods } as React.PointerEvent);
  });
const key = (k: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
  });

describe('useCanvasPolygonGesture', () => {
  it('closes the room on Enter, through the newest commit handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = setup(first);
    press(result, 0, 0);
    press(result, 100, 0);
    press(result, 100, 100);
    rerender({ pendingDraw: ROOM, onCommitRoomWalls: second });
    key('Enter');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(result.current.polygonVertices).toEqual([]);
  });

  it('takes the last corner back on Backspace', () => {
    const { result } = setup();
    press(result, 0, 0);
    press(result, 100, 0);
    key('Backspace');
    expect(result.current.polygonVertices).toEqual([{ x: 0, y: 0 }]);
  });

  it('clears the corners on Escape and stays armed', () => {
    const { result } = setup();
    press(result, 0, 0);
    key('Escape');
    expect(result.current.polygonVertices).toEqual([]);
    press(result, 50, 50);
    expect(result.current.polygonVertices).toEqual([{ x: 50, y: 50 }]);
  });

  it('keeps every corner of clicks that land before a render', () => {
    const { result } = setup();
    // Three presses in one act: no render commits between them, as with fast clicks inside one frame.
    act(() => {
      const place = result.current.beginPolygonPoint;
      place({ clientX: 0, clientY: 0 } as React.PointerEvent);
      place({ clientX: 100, clientY: 0 } as React.PointerEvent);
      place({ clientX: 100, clientY: 100 } as React.PointerEvent);
    });
    expect(result.current.polygonVertices).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('starts afresh after disarming and arming again', () => {
    const { result, rerender } = setup();
    press(result, 0, 0);
    rerender({ pendingDraw: null, onCommitRoomWalls: vi.fn() });
    rerender({ pendingDraw: ROOM, onCommitRoomWalls: vi.fn() });
    press(result, 50, 50);
    expect(result.current.polygonVertices).toEqual([{ x: 50, y: 50 }]);
  });

  it('clears the gesture when the tool disarms', () => {
    const { result, rerender } = setup();
    press(result, 0, 0);
    press(result, 100, 0);
    rerender({ pendingDraw: null, onCommitRoomWalls: vi.fn() });
    expect(result.current.polygonVertices).toEqual([]);
    expect(result.current.polygonCursor).toBeNull();
  });

  it('leaves the presses and keys alone while disarmed', () => {
    const onCommitRoomWalls = vi.fn();
    const { result, rerender } = setup(onCommitRoomWalls);
    rerender({ pendingDraw: null, onCommitRoomWalls });
    key('Enter');
    let claimed = true;
    act(() => {
      claimed = result.current.beginPolygonPoint({ clientX: 0, clientY: 0 } as React.PointerEvent);
    });
    expect(claimed).toBe(false);
    expect(result.current.handlePolygonDoubleClick()).toBe(false);
    expect(onCommitRoomWalls).not.toHaveBeenCalled();
  });

  it('snaps each corner after the first to 45 degrees from the last', () => {
    const { result } = setup();
    press(result, 100, 100);
    press(result, 300, 112);
    press(result, 390, 190);
    const [, second, third] = result.current.polygonVertices;
    expect(second).toEqual({ x: 300, y: 100 });
    expect(third!.x - 300).toBeCloseTo(third!.y - 100);
  });

  it('places a corner freely with Cmd or Ctrl held', () => {
    const { result } = setup();
    press(result, 100, 100);
    press(result, 300, 112, { metaKey: true });
    press(result, 320, 180, { ctrlKey: true });
    expect(result.current.polygonVertices.slice(1)).toEqual([
      { x: 300, y: 112 },
      { x: 320, y: 180 },
    ]);
  });

  it('closes the room on its first corner', () => {
    const { result, onCommitRoomWalls } = setup();
    press(result, 100, 100);
    press(result, 300, 100);
    press(result, 300, 300);
    press(result, 104, 104);
    expect(onCommitRoomWalls).toHaveBeenCalledWith([
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 },
    ]);
    expect(result.current.polygonVertices).toEqual([]);
  });

  it('closes on Enter or double-click only from three corners', () => {
    const { result, onCommitRoomWalls } = setup();
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

  it('swallows the second press of a double-click on the last corner', () => {
    const { result } = setup();
    press(result, 0, 0);
    press(result, 100, 0);
    press(result, 101, 0);
    expect(result.current.polygonVertices).toHaveLength(2);
  });
});
