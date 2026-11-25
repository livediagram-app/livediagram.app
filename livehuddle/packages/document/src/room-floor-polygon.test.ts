import { describe, expect, it } from 'vitest';
import { roomInterior } from '@livehuddle/avatar/office-geometry';
import {
  drawInPolygon,
  floorHasRoom,
  insidePolygonBy,
  polygonBounds,
  roomFloorPolygon,
  roomTurn,
  turnedRoomBox,
  turnRoomPoint,
} from './room-floor-polygon';
import { seeded } from './pet-wander';

// docs/specs/009-elements/office.md "A Room turns": what wanders or plays in a turned room keeps to its floor as drawn.
const upright = { x: 0, y: 0, width: 800, height: 400 };
const turned = { ...upright, rotation: 45 };

describe('a room floor as drawn', () => {
  it('reads a turn only when it is a finite part of a turn', () => {
    expect(roomTurn({ rotation: 45 })).toBe(45);
    expect(roomTurn({ rotation: 360 })).toBeNull();
    expect(roomTurn({ rotation: 0 })).toBeNull();
    expect(roomTurn({ rotation: Number.NaN })).toBeNull();
    expect(roomTurn({ rotation: '45' })).toBeNull();
    expect(roomTurn({})).toBeNull();
  });

  it('has no polygon for an upright box room, and its interior turned for a turned one', () => {
    expect(roomFloorPolygon(upright)).toBeNull();
    const floor = roomFloorPolygon(turned)!;
    const f = roomInterior(upright);
    expect(floor).toHaveLength(4);
    // Each corner of the upright interior, turned about the room's centre.
    const corner = turnRoomPoint(turned, { x: f.x, y: f.y });
    expect(floor[0]!.x).toBeCloseTo(corner.x);
    expect(floor[0]!.y).toBeCloseTo(corner.y);
    // The upright box's far corner is off the turned floor, the centre on it.
    expect(insidePolygonBy({ x: 780, y: 20 }, floor, 0)).toBe(false);
    expect(insidePolygonBy({ x: 400, y: 200 }, floor, 0)).toBe(true);
    expect(turnRoomPoint(upright, { x: 5, y: 6 })).toEqual({ x: 5, y: 6 });
  });

  it('reads a Room Builder outline, upright or turned, and nothing for a turned room with no floor', () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(roomFloorPolygon({ ...upright, roomOutline: outline })).toEqual([
      { x: 0, y: 0 },
      { x: 800, y: 0 },
      { x: 0, y: 400 },
    ]);
    expect(roomFloorPolygon({ ...upright, roomOutline: outline, rotation: 90 })).toHaveLength(3);
    expect(roomFloorPolygon({ x: 0, y: 0, width: 4, height: 4, rotation: 45 })).toBeNull();
  });

  it('turns the whole box, and bounds a polygon', () => {
    expect(turnedRoomBox(upright)).toBeNull();
    const b = polygonBounds(turnedRoomBox(turned)!);
    // An 800 by 400 box turned 45 degrees spans (800 + 400) / sqrt 2 each way.
    expect(b.width).toBeCloseTo(1200 / Math.SQRT2);
    expect(b.height).toBeCloseTo(1200 / Math.SQRT2);
  });

  it('keeps an inset from every edge', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(insidePolygonBy({ x: 50, y: 50 }, square, 20)).toBe(true);
    expect(insidePolygonBy({ x: 10, y: 50 }, square, 20)).toBe(false);
    expect(insidePolygonBy({ x: 150, y: 50 }, square, 20)).toBe(false);
    // A repeated point (an edge of no length) still measures.
    expect(insidePolygonBy({ x: 50, y: 50 }, [...square, square[3]!], 20)).toBe(true);
  });

  it('has room for an inset only when a spot that far in exists', () => {
    const floor = roomFloorPolygon(turned)!;
    expect(floorHasRoom(floor, 28)).toBe(true);
    // Its bounds are wide, but a 70 px room turned 30 degrees has no spot 28 px off every wall.
    expect(
      floorHasRoom(roomFloorPolygon({ x: 0, y: 0, width: 70, height: 70, rotation: 30 })!, 28),
    ).toBe(false);
    expect(floorHasRoom(floor, 1000)).toBe(false);
    // A drawn floor of other than four corners goes by its bounds.
    expect(
      floorHasRoom(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 0, y: 100 },
        ],
        20,
      ),
    ).toBe(true);
  });

  it('draws a spot inside, the same for the same seed, or none when every draw misses', () => {
    const floor = roomFloorPolygon(turned)!;
    const bounds = polygonBounds(floor);
    const a = drawInPolygon(floor, bounds, 28, seeded(7), 6);
    expect(a).toEqual(drawInPolygon(floor, bounds, 28, seeded(7), 6));
    expect(a && insidePolygonBy(a, floor, 28)).toBe(true);
    expect(drawInPolygon(floor, bounds, 10_000, seeded(7), 6)).toBeNull();
  });
});
