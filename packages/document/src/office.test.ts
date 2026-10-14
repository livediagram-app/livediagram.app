import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import {
  boxEdges,
  drinkFrom,
  isFloorShape,
  isOfficeShape,
  isRoomDoor,
  MEETING_TABLE_VIEW,
  OFFICE_ART,
  OFFICE_KINDS,
  officeFootprint,
  ROOM_BACK_FACE,
  ROOM_DOOR_WIDTH,
  ROOM_WALL,
  roomDoorSpan,
  roomParts,
  roomWalls,
} from './office';
import { nearestSeat, seatPoints } from './seating';
import { isValidElement } from './validate';

// docs/specs/009-elements/office.md
describe('the office pieces', () => {
  it('are seven shape kinds, each made at its drawing’s size', () => {
    expect(OFFICE_KINDS).toEqual([
      'room',
      'meeting-table',
      'plant',
      'bookshelf',
      'water-cooler',
      'coffee-machine',
      'rug',
    ]);
    for (const kind of OFFICE_KINDS) {
      expect(isOfficeShape(kind)).toBe(true);
      const el = createShape(kind, 0, 0);
      expect(isValidElement(el)).toBe(true);
      if (kind !== 'room') {
        const view = OFFICE_ART[kind].front;
        expect(el.width / el.height).toBeCloseTo(view.width / view.height, 2);
        expect(el.aspectLocked).toBe(true);
      }
    }
  });

  it('makes a room any rectangle, named Room, its doorway in the front wall', () => {
    const room = createShape('room', 0, 0);
    expect(room).toMatchObject({ label: 'Room', roomDoor: 's' });
    expect(room.aspectLocked).toBeFalsy();
  });

  it('puts the room and the rug on the floor, and nothing else', () => {
    expect(OFFICE_KINDS.filter(isFloorShape)).toEqual(['room', 'rug']);
  });

  it('gives water at the cooler and coffee at the machine', () => {
    expect(drinkFrom('water-cooler')).toBe('water');
    expect(drinkFrom('coffee-machine')).toBe('coffee');
    expect(drinkFrom('plant')).toBeNull();
  });

  it('accepts only the five doorways', () => {
    for (const d of ['n', 'e', 's', 'w', 'none']) expect(isRoomDoor(d)).toBe(true);
    expect(isRoomDoor('ne')).toBe(false);
    expect(isValidElement({ ...createShape('room', 0, 0), roomDoor: 'up' })).toBe(false);
  });
});

describe('the room', () => {
  const room = { x: 100, y: 50, width: 400, height: 300 };

  it('centres its doorway, narrower on a short wall, and none when closed', () => {
    expect(roomDoorSpan(400, 's')).toEqual([200 - ROOM_DOOR_WIDTH / 2, 200 + ROOM_DOOR_WIDTH / 2]);
    const [a, b] = roomDoorSpan(60, 's')!;
    expect(b - a).toBeLessThan(ROOM_DOOR_WIDTH);
    expect(roomDoorSpan(400, 'none')).toBeNull();
  });

  it('walls all four sides, broken only at the doorway', () => {
    const walls = roomWalls({ ...room, roomDoor: 's' });
    // Back, two halves of the front, left and right.
    expect(walls).toHaveLength(5);
    const front = walls.filter((w) => w.a.y === room.y + room.height - ROOM_WALL / 2);
    expect(front).toHaveLength(2);
    expect(front[0]!.b.x).toBe(room.x + 200 - ROOM_DOOR_WIDTH / 2);
    expect(front[1]!.a.x).toBe(room.x + 200 + ROOM_DOOR_WIDTH / 2);
    // The back wall stops you at the foot of its face, not at the top of the drawing.
    expect(walls[0]!.a.y).toBe(room.y + ROOM_BACK_FACE - ROOM_WALL / 2);
    expect(roomWalls({ ...room, roomDoor: 'none' })).toHaveLength(4);
    expect(roomWalls({ ...room, roomDoor: 'w' }).filter((w) => w.a.x === w.b.x)).toHaveLength(3);
  });

  it('is drawn at its own size: a floor, walls of a fixed thickness and a mat in the doorway', () => {
    const parts = roomParts(800, 600, 's');
    expect(parts[0]).toMatchObject({ role: 'floor', w: 800 });
    const sideWall = parts.find(
      (p) => p.tag === 'rect' && p.x === 0 && p.role === 'panel' && p.w === ROOM_WALL,
    );
    expect(sideWall).toBeDefined();
    expect(parts.some((p) => p.role === 'rail')).toBe(true);
    expect(roomParts(800, 600, 'none').some((p) => p.role === 'rail')).toBe(false);
  });
});

describe('scenery that blocks', () => {
  it('blocks at a plant’s pot and a bookshelf’s base, and nowhere for the rest', () => {
    const plant = officeFootprint({ x: 0, y: 0, width: 56, height: 88, shape: 'plant' })!;
    expect(plant.y).toBeGreaterThan(60);
    expect(plant.x).toBeGreaterThan(10);
    const shelf = officeFootprint({ x: 0, y: 0, width: 120, height: 132, shape: 'bookshelf' })!;
    expect(shelf.y / 132).toBeCloseTo(0.75, 2);
    for (const shape of ['water-cooler', 'coffee-machine', 'rug', 'meeting-table', 'room'])
      expect(officeFootprint({ x: 0, y: 0, width: 50, height: 50, shape })).toBeNull();
  });

  it('outlines a footprint with its four edges', () => {
    const edges = boxEdges({ x: 0, y: 0, width: 10, height: 20 });
    expect(edges).toHaveLength(4);
    expect(edges[0]).toEqual({ a: { x: 0, y: 0 }, b: { x: 10, y: 0 } });
  });
});

describe('the meeting table', () => {
  const table = { x: 0, y: 0, width: 232, height: 168, shape: 'meeting-table' as const };

  it('seats six, every seat facing the table', () => {
    const seats = seatPoints(table);
    expect(seats).toHaveLength(6);
    expect(seats.map((s) => s.facing)).toEqual(['down', 'down', 'up', 'up', 'right', 'left']);
    expect(MEETING_TABLE_VIEW.tableSeats).toHaveLength(6);
  });

  it('seats you on the seat nearest where you arrived, facing the table', () => {
    expect(nearestSeat(table, { x: 230, y: 70 })).toMatchObject({ facing: 'left' });
    expect(nearestSeat(table, { x: 90, y: 0 })).toMatchObject({ facing: 'down' });
    expect(nearestSeat(table, { x: 150, y: 168 })).toMatchObject({ facing: 'up' });
  });
});
