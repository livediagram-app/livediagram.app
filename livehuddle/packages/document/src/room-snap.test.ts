import { describe, expect, it } from 'vitest';
import {
  createOutlinedRoom,
  createShape,
  roomWalls,
  snapRoomWalls,
  snapRoomWallsResize,
  ROOM_WALL,
} from './index';
import type { ShapeElement } from './index';

// docs/specs/009-elements/office.md "Rooms line up": two rooms side by side share one wall line.
const room = (id: string, x: number, y: number, w = 400, h = 300): ShapeElement => ({
  ...createShape('room', x, y),
  id,
  width: w,
  height: h,
  roomDoor: 'none',
});
const none = new Set<string>();
const box = (r: ShapeElement) => ({ x: r.x, y: r.y, width: r.width, height: r.height });

describe('snapRoomWalls', () => {
  const a = room('a', 0, 0);

  it('puts a room to the right of another on its right wall, the two sharing that wall line', () => {
    const b = room('b', 400 - ROOM_WALL + 4, 0);
    const snap = snapRoomWalls(box(b), [a], none, 6);
    expect(snap).toMatchObject({ dx: -4, snappedX: true, snappedY: false });
    const placed = { ...b, x: b.x + snap.dx };
    const right = roomWalls(a).find((w) => w.a.x === w.b.x && w.a.x > 200)!;
    const left = roomWalls(placed).find((w) => w.a.x === w.b.x && w.a.x < placed.x + 200)!;
    expect(left.a.x).toBe(right.a.x);
    expect(snap.guides).toEqual([{ axis: 'x', position: right.a.x, start: 0, end: 300 }]);
  });

  it('puts a room to the left, below and above another on the shared wall line', () => {
    expect(snapRoomWalls(box(room('l', -400 + ROOM_WALL - 3, 0)), [a], none, 6).dx).toBe(3);
    // Below: its back wall's line on the other's front wall line.
    const below = snapRoomWalls(box(room('d', 0, 300 - 36 + 5)), [a], none, 6);
    expect(below.dy).toBe(-5);
    const placed = room('d', 0, 300 - 36);
    const front = roomWalls(a).find((w) => w.a.y === w.b.y && w.a.y > 100)!;
    const back = roomWalls(placed).find((w) => w.a.y === w.b.y && w.a.y < placed.y + 100)!;
    expect(back.a.y).toBe(front.a.y);
    expect(snapRoomWalls(box(room('u', 0, -300 + 36 - 2)), [a], none, 6).dy).toBe(2);
  });

  it('leaves a room out of reach, itself, and custom rooms alone', () => {
    expect(snapRoomWalls(box(room('far', 600, 0)), [a], none, 6).snappedX).toBe(false);
    expect(snapRoomWalls(box(room('a', 392, 0)), [a], new Set(['a']), 6).snappedX).toBe(false);
    const custom = createOutlinedRoom([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 0, y: 300 },
    ])!;
    expect(snapRoomWalls(box(room('b', 395, 0)), [custom], none, 6).snappedX).toBe(false);
  });

  it('takes the nearest wall per axis across several rooms', () => {
    const c = room('c', 0, 400);
    const snap = snapRoomWalls(box(room('b', 392, 402)), [a, c], none, 6);
    expect(snap.dx).toBe(-2);
  });
});

describe('snapRoomWallsResize', () => {
  const a = room('a', 0, 0);

  it("lands a room's moving right wall on the neighbour's left wall line, its left edge staying put", () => {
    const b = { x: -500, y: 0, width: 497 + ROOM_WALL, height: 300 };
    const { bounds, guides } = snapRoomWallsResize(b, 'e', [a], none, 6);
    expect(bounds).toEqual({ x: -500, y: 0, width: 500 + ROOM_WALL, height: 300 });
    expect(guides[0]).toMatchObject({ axis: 'x', position: ROOM_WALL / 2 });
  });

  it('lands a moving left or top wall, shrinking from that side, and leaves the bounds when none is near', () => {
    const left = snapRoomWallsResize({ x: 393, y: 0, width: 300, height: 300 }, 'w', [a], none, 6);
    expect(left.bounds).toEqual({ x: 390, y: 0, width: 303, height: 300 });
    const top = snapRoomWallsResize({ x: 0, y: 266, width: 400, height: 300 }, 'nw', [a], none, 6);
    expect(top.bounds.y).toBe(264);
    expect(top.bounds.height).toBe(302);
    // A moving bottom wall lands on the back wall line of a room below.
    const below = room('c', 0, 600);
    const bottom = snapRoomWallsResize(
      { x: 0, y: 0, width: 400, height: 640 },
      's',
      [below],
      none,
      6,
    );
    expect(bottom.bounds.height).toBe(636);
    const free = { x: 1000, y: 0, width: 300, height: 300 };
    expect(snapRoomWallsResize(free, 'se', [a], none, 6)).toEqual({ bounds: free, guides: [] });
  });
});
