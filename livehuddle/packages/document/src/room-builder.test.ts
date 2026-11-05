import { describe, expect, it } from 'vitest';
import {
  createOutlinedRoom,
  createShape,
  doorOnRoom,
  doorParts,
  doorsFollowRooms,
  DOOR_REACH,
  isNextToDoor,
  toggledDoor,
  hasBuiltInDoorway,
  isOutlinedRoom,
  isRoomOutline,
  isValidElement,
  outlinedRoomPaths,
  roomOutlinePoints,
  roomWalls,
  roomWithDoorPiece,
  roomZones,
  snapDoorToWall,
  snapMovedDoors,
  withAttachedDoors,
  withDoorPiece,
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
    // Closed, the leaf lies across the opening from the same hinge, as long as it stood.
    expect(p.shut).toEqual({ x: p.leaf.x, y: p.leaf.y - 1.5, w: p.leaf.h, h: 3 });
  });
});

// docs/specs/009-elements/room-builder.md "Opening and closing".
describe('opening and closing a door', () => {
  // A door across x 100..196 on the line y 0.
  const door = { ...createShape('door', 100, -12), width: 96, height: 24 };

  it('is next to a character within DOOR_REACH of its opening, on either side', () => {
    expect(isNextToDoor({ x: 148, y: DOOR_REACH }, door)).toBe(true);
    expect(isNextToDoor({ x: 148, y: -DOOR_REACH }, door)).toBe(true);
    expect(isNextToDoor({ x: 148, y: DOOR_REACH + 1 }, door)).toBe(false);
    // Past its end, measured to the end of the opening.
    expect(isNextToDoor({ x: 196 + 30, y: 30 }, door)).toBe(true);
    expect(isNextToDoor({ x: 196 + 40, y: 40 }, door)).toBe(false);
    // Only a door is a door; a zero-width one is its one point.
    expect(isNextToDoor({ x: 148, y: 0 }, { ...door, shape: 'chair' })).toBe(false);
    expect(isNextToDoor({ x: 100, y: 10 }, { ...door, width: 0 })).toBe(true);
  });

  it('turns open to closed and back, an open door storing nothing', () => {
    const shut = toggledDoor(door);
    expect(shut.doorClosed).toBe(true);
    const open = toggledDoor(shut);
    expect('doorClosed' in open).toBe(false);
    expect(open).toEqual(door);
    expect(isValidElement(shut)).toBe(true);
    expect(isValidElement({ ...door, doorClosed: 'yes' })).toBe(false);
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

// docs/specs/009-elements/office.md "The doorway is a Door"
describe("a Room's doorway as a Door piece", () => {
  const room = (over: Partial<ShapeElement> = {}): ShapeElement => ({
    ...createShape('room', 100, 200),
    ...over,
  });
  const middle = (d: ShapeElement) => ({ x: d.x + d.width / 2, y: d.y + d.height / 2 });

  it('closes the room and stands a Door in the middle of its front wall', () => {
    const r = room({ roomDoor: undefined, fillColor: '#abcdef', strokeColor: '#123456' });
    const { room: closed, door } = roomWithDoorPiece(r);
    expect(closed).toMatchObject({ id: r.id, roomDoor: 'none', width: 480, height: 320 });
    expect(door).toMatchObject({
      shape: 'door',
      rotation: 0,
      fillColor: '#abcdef',
      strokeColor: '#123456',
    });
    expect(middle(door!)).toEqual({ x: 100 + 240, y: 200 + 320 - ROOM_WALL / 2 });
    expect(doorOnRoom(door!, closed)).toBe(true);
    expect(hasBuiltInDoorway(closed)).toBe(false);
  });

  it('stands it on whichever wall the doorway was in', () => {
    for (const side of ['n', 'e', 's', 'w'] as const) {
      const { room: closed, door } = roomWithDoorPiece(room({ roomDoor: side }));
      expect(doorOnRoom(door!, closed), side).toBe(true);
      expect(door!.rotation ?? 0, side).toBe(side === 'e' || side === 'w' ? 90 : 0);
    }
  });

  it('gives no door to a closed room, a wall too short, a custom room or another kind', () => {
    expect(roomWithDoorPiece(room({ roomDoor: 'none' })).door).toBeNull();
    const tiny = roomWithDoorPiece(room({ width: 60, height: 60 }));
    expect(tiny.door).toBeNull();
    expect(tiny.room.roomDoor).toBe('none');
    const custom = createOutlinedRoom([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 0, y: 300 },
    ])!;
    expect(roomWithDoorPiece(custom)).toEqual({ room: custom, door: null });
    const chair = createShape('chair', 0, 0);
    expect(roomWithDoorPiece(chair)).toEqual({ room: chair, door: null });
  });

  it('adds the Door after a new room, and leaves anything else alone', () => {
    const [closed, door] = withDoorPiece(room());
    expect(closed).toMatchObject({ shape: 'room', roomDoor: 'none' });
    expect(door).toMatchObject({ shape: 'door' });
    const chair = createShape('chair', 0, 0);
    expect(withDoorPiece(chair)).toEqual([chair]);
    expect(withDoorPiece(room({ roomDoor: 'none' }))).toHaveLength(1);
  });

  it('cuts the wall where the doorway was: walls block, the Door lets through', () => {
    const { room: closed, door } = roomWithDoorPiece(room());
    // The closed room's front wall runs unbroken; the Door standing on it is the way in.
    const front = roomWalls(closed).filter(
      (w) => w.a.y === w.b.y && w.a.y === 200 + 320 - ROOM_WALL / 2,
    );
    expect(front).toHaveLength(1);
    expect(snapDoorToWall(door!, [closed])).toBe(door);
  });

  it('says which rooms keep a doorway of their own', () => {
    expect(hasBuiltInDoorway(room({ roomDoor: undefined }))).toBe(true);
    expect(hasBuiltInDoorway(room({ roomDoor: 'e' }))).toBe(true);
    expect(hasBuiltInDoorway(room({ roomDoor: 'none' }))).toBe(false);
    expect(hasBuiltInDoorway(createShape('chair', 0, 0))).toBe(false);
  });
});

// docs/specs/009-elements/room-builder.md "It rides its room": a resize carries the room's Doors.
describe('doorsFollowRooms', () => {
  const [room, door] = withDoorPiece({ ...createShape('room', 0, 0), width: 400, height: 300 }) as [
    ShapeElement,
    ShapeElement,
  ];
  const middle = (d: Element) =>
    d.type === 'shape' ? { x: d.x + d.width / 2, y: d.y + d.height / 2 } : null;

  it('keeps a door in the middle of its wall through a resize', () => {
    const wider = { ...room, width: 600, height: 400 };
    const out = doorsFollowRooms([room, door], [wider, door]);
    expect(middle(out[1]!)).toEqual({ x: 300, y: 400 - ROOM_WALL / 2 });
    expect(doorOnRoom(out[1] as ShapeElement, wider)).toBe(true);
  });

  it('keeps its fraction along the wall, and stays on a wall that shrinks past it', () => {
    const slid = snapDoorToWall({ ...door, x: 260 }, [room]);
    const half = { ...room, width: 200 };
    const out = doorsFollowRooms([room, slid], [half, slid]);
    expect(doorOnRoom(out[1] as ShapeElement, half)).toBe(true);
    const narrow = { ...room, width: 110 };
    const squeezed = doorsFollowRooms([room, slid], [narrow, slid]);
    // Clamped clear of the wall's end: its far edge at the wall's end.
    expect(middle(squeezed[1]!)!.x).toBeCloseTo(110 - 48, 5);
  });

  it('carries a door on a side wall, and leaves a door elsewhere alone', () => {
    const side = snapDoorToWall({ ...door, x: 400 - 48, y: 150 - 12 }, [room]);
    const free = { ...createShape('door', 1000, 1000), id: 'free' };
    const taller = { ...room, height: 500 };
    const out = doorsFollowRooms([room, side, free], [taller, side, free]);
    expect(middle(out[1]!)!.y).toBeCloseTo(250, 5);
    expect(out[2]).toBe(free);
  });

  it('returns the same array when no room changed', () => {
    const after = [room, door];
    expect(doorsFollowRooms([room, door], after)).toBe(after);
    const moved = [{ ...room }, door];
    expect(doorsFollowRooms([room, door], moved)).toBe(moved);
  });
});
