import { describe, expect, it } from 'vitest';
import {
  createOutlinedRoom,
  createShape,
  doorOnRoom,
  doorParts,
  isOutlinedRoom,
  isRoomOutline,
  isValidElement,
  outlinedRoomPaths,
  roomOutlinePoints,
  roomZones,
  snapDoorToWall,
  snapMovedDoors,
  withAttachedDoors,
  zoneAt,
  ROOM_WALL,
  type Element,
  type ShapeElement,
} from './index';

// docs/specs/009-elements/room-builder.md.

// An L with a 45-degree corner, the walls' centre line in canvas px.
const CORNERS = [
  { x: 100, y: 100 },
  { x: 300, y: 100 },
  { x: 300, y: 200 },
  { x: 200, y: 300 },
  { x: 100, y: 300 },
];

function room(): ShapeElement {
  const r = createOutlinedRoom(CORNERS);
  if (!r) throw new Error('no room');
  return r;
}

function door(at: { x: number; y: number }, rotation = 0): ShapeElement {
  const d = createShape('door', 0, 0);
  return { ...d, x: at.x - d.width / 2, y: at.y - d.height / 2, rotation };
}

describe('createOutlinedRoom', () => {
  it('boxes the corners with half a wall to spare and keeps them as fractions', () => {
    const r = room();
    expect(r.shape).toBe('room');
    expect(r.x).toBe(100 - ROOM_WALL / 2);
    expect(r.width).toBe(200 + ROOM_WALL);
    expect(r.aspectLocked).toBe(true);
    expect(r.roomDoor).toBe('none');
    expect(r.label).toBe('Room');
    expect(isOutlinedRoom(r)).toBe(true);
    expect(isValidElement(r)).toBe(true);
    const pts = roomOutlinePoints(r as ShapeElement & { roomOutline: { x: number; y: number }[] });
    pts.forEach((p, i) => {
      expect(p.x).toBeCloseTo(CORNERS[i]!.x);
      expect(p.y).toBeCloseTo(CORNERS[i]!.y);
    });
  });

  it('drops repeated corners and a last corner back on the first', () => {
    const r = createOutlinedRoom([
      ...CORNERS.slice(0, 2),
      CORNERS[1]!,
      ...CORNERS.slice(2),
      CORNERS[0]!,
    ]);
    expect(r?.roomOutline).toHaveLength(5);
  });

  it('cancels with fewer than three corners or no floor', () => {
    expect(createOutlinedRoom(CORNERS.slice(0, 2))).toBeNull();
    expect(
      createOutlinedRoom([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 0 },
      ]),
    ).toBeNull();
  });
});

describe('isRoomOutline', () => {
  it('takes three to two hundred corners inside the box', () => {
    expect(isRoomOutline(room().roomOutline)).toBe(true);
    expect(
      isRoomOutline([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    ).toBe(false);
    expect(isRoomOutline('no')).toBe(false);
    expect(isRoomOutline([{ x: 0, y: 0 }, { x: 1, y: 0 }, null])).toBe(false);
    expect(
      isRoomOutline([
        { x: 0, y: 0 },
        { x: 1.5, y: 0 },
        { x: 0, y: 1 },
      ]),
    ).toBe(false);
    expect(
      isRoomOutline([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: Number.NaN },
      ]),
    ).toBe(false);
    expect(
      isRoomOutline([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: '0', y: 1 },
      ]),
    ).toBe(false);
    expect(isRoomOutline(Array.from({ length: 201 }, () => ({ x: 0, y: 0 })))).toBe(false);
  });

  it('makes a room with a bad outline invalid', () => {
    expect(isValidElement({ ...room(), roomOutline: [{ x: 0, y: 0 }] })).toBe(false);
  });
});

describe('snapDoorToWall', () => {
  it("puts a door near a wall onto it, turned to the wall, in the room's floor", () => {
    const r = { ...room(), fillColor: '#abcdef' };
    const d = snapDoorToWall(door({ x: 200, y: 120 }), [r]);
    expect(d.x + d.width / 2).toBeCloseTo(200);
    expect(d.y + d.height / 2).toBeCloseTo(100);
    expect(d.rotation).toBe(0);
    expect(d.fillColor).toBe('#abcdef');
  });

  it('turns a door onto the 45-degree wall', () => {
    const d = snapDoorToWall(door({ x: 260, y: 260 }), [room()]);
    expect(d.rotation).toBe(135);
    expect(d.x + d.width / 2).toBeCloseTo(250);
    expect(d.y + d.height / 2).toBeCloseTo(250);
    expect(d.fillColor).toBeUndefined();
  });

  it("snaps onto a rectangular Room's walls too", () => {
    const plain = createShape('room', 0, 0);
    const d = snapDoorToWall(door({ x: 200, y: 300 }), [plain]);
    expect(d.y + d.height / 2).toBeCloseTo(plain.height - ROOM_WALL / 2);
  });

  it('leaves a door away from every wall, a door already on one, and anything not a door', () => {
    const far = door({ x: 1000, y: 1000 });
    expect(snapDoorToWall(far, [room()])).toBe(far);
    const on = snapDoorToWall(door({ x: 200, y: 110 }), [room()]);
    expect(snapDoorToWall(on, [room()])).toBe(on);
    const unturned: ShapeElement = { ...on };
    delete unturned.rotation;
    expect(snapDoorToWall(unturned, [room()])).toBe(unturned);
    const plant = createShape('plant', 0, 0);
    expect(snapDoorToWall(plant, [room()])).toBe(plant);
    const r = room();
    expect(snapDoorToWall(door({ x: 200, y: 110 }), [r], new Set([r.id])).y).toBe(110 - 12);
  });

  it('drops a fill the door no longer stands in', () => {
    const coloured = { ...door({ x: 200, y: 110 }), fillColor: '#111111' };
    expect(snapDoorToWall(coloured, [room()]).fillColor).toBeUndefined();
  });
});

describe('snapMovedDoors / doors riding their room', () => {
  it('snaps only the moved doors, and returns the same array when nothing moved', () => {
    const r = room();
    const moved = door({ x: 200, y: 120 });
    const still = door({ x: 200, y: 280 });
    const els: Element[] = [r, moved, still];
    const out = snapMovedDoors(els, new Set([moved.id]));
    expect((out[1] as ShapeElement).y).not.toBe(moved.y);
    expect(out[2]).toBe(still);
    expect(snapMovedDoors(els, new Set(['nobody']))).toBe(els);
    const placed = snapMovedDoors(els, new Set([moved.id]));
    expect(snapMovedDoors(placed, new Set([moved.id]))).toBe(placed);
  });

  it("carries the doors on a moved room's walls, and only those", () => {
    const r = room();
    const on = snapDoorToWall(door({ x: 200, y: 110 }), [r]);
    const loose = door({ x: 900, y: 900 });
    const els: Element[] = [r, on, loose];
    expect(doorOnRoom(on, r)).toBe(true);
    expect(doorOnRoom(loose, r)).toBe(false);
    expect(doorOnRoom(r, r)).toBe(false);
    const ids = withAttachedDoors(els, new Set([r.id]));
    expect([...ids].sort()).toEqual([r.id, on.id].sort());
    const none = new Set([loose.id]);
    expect(withAttachedDoors(els, none)).toBe(none);
    const both = new Set([r.id, on.id]);
    expect(withAttachedDoors(els, both)).toBe(both);
    const plain = createShape('room', 0, 0);
    const plainDoor = snapDoorToWall(door({ x: 100, y: 300 }), [plain]);
    expect(doorOnRoom(plainDoor, plain)).toBe(true);
  });
});

describe('drawing', () => {
  it("draws a custom room's floor and walls along its outline", () => {
    const { floor, walls } = outlinedRoomPaths({
      width: 100,
      height: 50,
      roomOutline: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
    });
    expect(floor).toBe('M0 0 L100 0 L0 50 Z');
    expect(walls).toBe(floor);
  });

  it('draws a door: its gap over the wall, two jambs, an open leaf and its swing', () => {
    const p = doorParts(96, 24);
    expect(p.gap.w).toBe(96);
    expect(p.gap.h).toBe(ROOM_WALL + 3);
    expect(p.jambs).toHaveLength(2);
    expect(p.leaf.h).toBe(96 - 12);
    expect(p.swing.startsWith('M90 12 A84 84')).toBe(true);
    // A narrow door keeps its jambs a quarter of it each.
    expect(doorParts(8, 24).jambs[0]!.w).toBe(2);
  });
});

describe('a custom room is a call of its own', () => {
  it('counts only the floor inside the outline', () => {
    const r = room();
    const zones = roomZones([r]);
    expect(zones).toHaveLength(1);
    expect(zones[0]!.polygon).toHaveLength(5);
    expect(zoneAt({ x: 150, y: 150 }, zones)).toBe(r.id);
    // The cut-off corner is outside the walls though inside the box.
    expect(zoneAt({ x: 290, y: 290 }, zones)).toBeNull();

    // A plain Room standing on the custom room's floor is the smaller call, so it wins inside it.
    const inner = { ...createShape('room', 0, 0), x: 110, y: 110, width: 150, height: 150 };
    const both = roomZones([r, inner]);
    expect(zoneAt({ x: 180, y: 220 }, both)).toBe(inner.id);
    expect(zoneAt({ x: 280, y: 150 }, both)).toBe(r.id);
  });

  it('skips an outline with no floor', () => {
    const flat = {
      ...room(),
      roomOutline: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 1, y: 0 },
      ],
    };
    expect(roomZones([flat])).toEqual([]);
  });
});
