import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import {
  isFloorShape,
  isOfficeShape,
  isRoomDoor,
  MEETING_TABLE_VIEW,
  OFFICE_ART,
  OFFICE_KINDS,
  ROOM_WALL,
  roomParts,
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

  it('accepts only the five doorways', () => {
    for (const d of ['n', 'e', 's', 'w', 'none']) expect(isRoomDoor(d)).toBe(true);
    expect(isRoomDoor('ne')).toBe(false);
    expect(isValidElement({ ...createShape('room', 0, 0), roomDoor: 'up' })).toBe(false);
  });
});

describe('the room', () => {
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

describe('roomParts at the smallest sizes', () => {
  it('draws no part with a negative or zero size, however small the room', () => {
    for (const door of ['n', 's', 'e', 'w'] as const)
      for (const [w, h] of [
        [36, 200],
        [200, 20],
        [10, 10],
      ] as const)
        for (const p of roomParts(w, h, door))
          if (p.tag === 'rect') {
            expect(p.w, `${door} ${w}x${h} ${p.role}`).toBeGreaterThan(0);
            expect(p.h, `${door} ${w}x${h} ${p.role}`).toBeGreaterThan(0);
          }
  });
});
