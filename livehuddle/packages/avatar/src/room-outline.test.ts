import { describe, expect, it } from 'vitest';
import { fenceSegments, fenceStep } from './collision';
import { roomWalls, ROOM_WALL } from './office-geometry';
import {
  cutByDoors,
  doorLine,
  doorSpanOnWall,
  nearestWall,
  outlineWalls,
  pointInPolygon,
  polygonArea,
  snap45,
} from './room-outline';

// docs/specs/009-elements/room-builder.md.

describe('snap45', () => {
  it('keeps a wall along the nearest of the eight directions', () => {
    const o = { x: 0, y: 0 };
    expect(snap45(o, { x: 100, y: 10 })).toEqual({ x: 100, y: 0 });
    expect(snap45(o, { x: -5, y: 80 })).toEqual({ x: 0, y: 80 });
    expect(snap45(o, { x: -90, y: -4 })).toEqual({ x: -90, y: 0 });
    const diag = snap45(o, { x: 100, y: 90 });
    expect(diag.x).toBeCloseTo(95);
    expect(diag.y).toBeCloseTo(95);
    const up = snap45(o, { x: 70, y: -80 });
    expect(up.x).toBeCloseTo(75);
    expect(up.y).toBeCloseTo(-75);
  });

  it('stays put on a zero-length move', () => {
    expect(snap45({ x: 3, y: 4 }, { x: 3, y: 4 })).toEqual({ x: 3, y: 4 });
  });
});

const L_SHAPE = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 0.5 },
  { x: 0.5, y: 1 },
  { x: 0, y: 1 },
];

describe('outlineWalls', () => {
  it('walls each corner to the next and the last back to the first, in canvas px', () => {
    const walls = outlineWalls({ x: 10, y: 20, width: 200, height: 100 }, L_SHAPE);
    expect(walls).toHaveLength(5);
    expect(walls[0]).toEqual({ a: { x: 10, y: 20 }, b: { x: 210, y: 20 } });
    expect(walls[4]).toEqual({ a: { x: 10, y: 120 }, b: { x: 10, y: 20 } });
  });

  it('drops a wall of no length', () => {
    const dup = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(outlineWalls({ x: 0, y: 0, width: 10, height: 10 }, dup)).toHaveLength(3);
  });

  it('is what a room with an outline walls itself with, with no doorway', () => {
    const room = {
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      roomOutline: L_SHAPE,
      roomDoor: 's' as const,
    };
    expect(roomWalls(room)).toEqual(outlineWalls(room, L_SHAPE));
  });
});

describe('pointInPolygon / polygonArea', () => {
  const poly = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 50, y: 100 },
    { x: 0, y: 100 },
  ];
  it('tells inside from the cut-off corner', () => {
    expect(pointInPolygon({ x: 20, y: 20 }, poly)).toBe(true);
    expect(pointInPolygon({ x: 90, y: 90 }, poly)).toBe(false);
    expect(pointInPolygon({ x: -1, y: 50 }, poly)).toBe(false);
  });
  it('measures the area either way round', () => {
    expect(polygonArea(poly)).toBe(10000 - 1250);
    expect(polygonArea([...poly].reverse())).toBe(8750);
  });
});

describe('doors', () => {
  const wall = { a: { x: 0, y: 0 }, b: { x: 200, y: 0 } };

  it('lays a door along its rotation, centred on its box', () => {
    const line = doorLine({ x: 52, y: -12, width: 96, height: 24 });
    expect(line.a.x).toBeCloseTo(52);
    expect(line.b.x).toBeCloseTo(148);
    expect(line.a.y).toBeCloseTo(0);
    const turned = doorLine({ x: 0, y: 0, width: 96, height: 24, rotation: 90 });
    expect(turned.a.x).toBeCloseTo(48);
    expect(turned.a.y).toBeCloseTo(-36);
  });

  it('spans its wall only when centred on it and running along it', () => {
    const on = doorLine({ x: 52, y: -12, width: 96, height: 24 });
    expect(doorSpanOnWall(wall, on)).toEqual([52, 148]);
    const off = doorLine({ x: 52, y: -2, width: 96, height: 24 });
    expect(doorSpanOnWall(wall, off)).toBeNull();
    const across = doorLine({ x: 52, y: -12, width: 96, height: 24, rotation: 90 });
    expect(doorSpanOnWall(wall, across)).toBeNull();
    // A door hanging off the wall's end covers only what is wall.
    expect(doorSpanOnWall(wall, doorLine({ x: 150, y: -12, width: 96, height: 24 }))).toEqual([
      150, 200,
    ]);
    expect(doorSpanOnWall({ a: wall.a, b: wall.a }, on)).toBeNull();
    expect(doorSpanOnWall(wall, { a: { x: 5, y: 0 }, b: { x: 5, y: 0 } })).toBeNull();
  });

  it('cuts the walls it stands on and leaves the rest', () => {
    const other = { a: { x: 0, y: 0 }, b: { x: 0, y: 100 } };
    const doors = [
      doorLine({ x: 20, y: -12, width: 40, height: 24 }),
      doorLine({ x: 100, y: -12, width: 40, height: 24 }),
    ];
    const cut = cutByDoors([wall, other], doors);
    expect(cut).toEqual([
      { a: { x: 0, y: 0 }, b: { x: 20, y: 0 } },
      { a: { x: 60, y: 0 }, b: { x: 100, y: 0 } },
      { a: { x: 140, y: 0 }, b: { x: 200, y: 0 } },
      other,
    ]);
    expect(cutByDoors([wall], [])).toEqual([wall]);
    // A door to the wall's very end leaves no stub past it.
    expect(cutByDoors([wall], [doorLine({ x: 160, y: -12, width: 40, height: 24 })])).toEqual([
      { a: { x: 0, y: 0 }, b: { x: 160, y: 0 } },
    ]);
  });

  it('cuts a 45-degree wall too', () => {
    const diag = { a: { x: 0, y: 0 }, b: { x: 200, y: 200 } };
    const c = { x: 100, y: 100 };
    const door = doorLine({ x: c.x - 48, y: c.y - 12, width: 96, height: 24, rotation: 45 });
    const cut = cutByDoors([diag], [door]);
    expect(cut).toHaveLength(2);
    expect(cut[0]!.b.x).toBeCloseTo(100 - 48 / Math.SQRT2);
    expect(cut[1]!.a.x).toBeCloseTo(100 + 48 / Math.SQRT2);
  });

  it('snaps to the nearest wall within reach, at its angle, clear of its ends', () => {
    const diag = { a: { x: 300, y: 0 }, b: { x: 400, y: 100 } };
    expect(nearestWall({ x: 100, y: 30 }, [wall, diag], 48)).toEqual({
      index: 0,
      at: { x: 100, y: 0 },
      angle: 0,
    });
    const onDiag = nearestWall({ x: 360, y: 40 }, [wall, diag], 48)!;
    expect(onDiag.angle).toBe(45);
    expect(onDiag.at).toEqual({ x: 350, y: 50 });
    expect(nearestWall({ x: 100, y: 60 }, [wall], 48)).toBeNull();
    // Near the end, a 96-wide door stays 48 in from it.
    expect(nearestWall({ x: 195, y: 5 }, [wall], 48, 48)!.at).toEqual({ x: 152, y: 0 });
    // On a wall shorter than the door, it sits in the middle.
    const short = { a: { x: 0, y: 0 }, b: { x: 60, y: 0 } };
    expect(nearestWall({ x: 5, y: 5 }, [short], 48, 48)!.at).toEqual({ x: 30, y: 0 });
    // A wall running right to left reads the same angle as left to right, and a degenerate wall is skipped.
    const back = { a: { x: 200, y: 0 }, b: { x: 0, y: 0 } };
    expect(nearestWall({ x: 50, y: 1 }, [{ a: wall.a, b: wall.a }, back], 48)!.angle).toBe(0);

    // Of two walls in reach, the nearer wins whichever comes first.
    const near = { a: { x: 0, y: 10 }, b: { x: 200, y: 10 } };
    expect(nearestWall({ x: 50, y: 12 }, [near, wall], 48)!.at).toEqual({ x: 50, y: 10 });
    // A wall a hair off horizontal, drawn right to left, reads as 0 rather than 180.
    const hair = { a: { x: 200, y: 0 }, b: { x: 0, y: 1e-12 } };
    expect(nearestWall({ x: 50, y: 1 }, [hair], 48)!.angle).toBe(0);
  });

  it("covers nothing of a wall when it stands past the wall's end, and cuts from the start", () => {
    expect(doorSpanOnWall(wall, doorLine({ x: 300, y: -12, width: 40, height: 24 }))).toBeNull();
    expect(cutByDoors([wall], [doorLine({ x: -20, y: -12, width: 40, height: 24 })])).toEqual([
      { a: { x: 20, y: 0 }, b: { x: 200, y: 0 } },
    ]);
  });
});

describe('a door in the walk', () => {
  // A 45-degree-walled room with a door on its diagonal: the walk goes through the door and not the wall.
  const room = {
    id: 'r',
    type: 'shape' as const,
    shape: 'room',
    x: 0,
    y: 0,
    width: 400,
    height: 400,
    roomOutline: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 1, y: 0.5 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
  };
  // The diagonal runs (200, 0) to (400, 200); its middle is (300, 100).
  const door = {
    id: 'd',
    type: 'shape' as const,
    shape: 'door',
    x: 300 - 48,
    y: 100 - 12,
    width: 96,
    height: 24,
    rotation: 45,
  };

  it('breaks the diagonal wall at the door', () => {
    const walls = fenceSegments([room]);
    const cut = fenceSegments([room, door]);
    expect(cut.length).toBe(walls.length + 1);
  });

  it('lets a character through the door, and stops it at the wall beside it', () => {
    const reach = 12;
    const inside = { x: 280, y: 120 };
    const outside = { x: 320, y: 80 };
    const through = fenceStep(inside, outside, fenceSegments([room, door]), reach);
    expect(through.blocked).toBe(false);
    expect(through.pos).toEqual(outside);
    const blocked = fenceStep(inside, outside, fenceSegments([room]), reach);
    expect(blocked.blocked).toBe(true);
  });

  // room-builder.md "Opening and closing": a closed door is wall again.
  it('stops a character at a closed door as at the wall, and lets it through once opened', () => {
    const reach = 12;
    const inside = { x: 280, y: 120 };
    const outside = { x: 320, y: 80 };
    const shut = { ...door, doorClosed: true };
    expect(fenceSegments([room, shut])).toEqual(fenceSegments([room]));
    expect(fenceStep(inside, outside, fenceSegments([room, shut]), reach).blocked).toBe(true);
    const open = { ...door, doorClosed: false };
    expect(fenceStep(inside, outside, fenceSegments([room, open]), reach).blocked).toBe(false);
  });

  it('keeps the wall thickness constant', () => {
    expect(ROOM_WALL).toBe(10);
  });
});
