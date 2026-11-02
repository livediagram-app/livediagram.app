import { describe, expect, it } from 'vitest';
import {
  boxEdges,
  drinkFrom,
  isFloorShape,
  isRoomDoor,
  isSeatingShape,
  officeFootprint,
  ROOM_BACK_FACE,
  ROOM_DOOR_WIDTH,
  ROOM_WALL,
  roomDoorSpan,
  roomWalls,
} from './office-geometry';

// livediagram's docs/specs/009-elements/office.md
describe('the office pieces', () => {
  it('gives water at the cooler and coffee at the machine', () => {
    expect(drinkFrom('water-cooler')).toBe('water');
    expect(drinkFrom('coffee-machine')).toBe('coffee');
    expect(drinkFrom('plant')).toBeNull();
  });

  it('lays the room, the rug and the Avatar Pad on the floor', () => {
    expect(['room', 'rug', 'avatar-pad'].every(isFloorShape)).toBe(true);
    expect(isFloorShape('plant')).toBe(false);
  });

  it('accepts only the five doorways', () => {
    for (const d of ['n', 'e', 's', 'w', 'none']) expect(isRoomDoor(d)).toBe(true);
    expect(isRoomDoor('ne')).toBe(false);
  });

  it('seats a character in a chair, a desk, a sofa and at the meeting table', () => {
    expect(['chair', 'desk', 'sofa', 'meeting-table'].every(isSeatingShape)).toBe(true);
    expect(isSeatingShape('fence')).toBe(false);
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
});

describe('the room’s doorway on every wall', () => {
  const room = { x: 0, y: 0, width: 400, height: 300 };

  it('has no doorway on a wall too short for one', () => {
    expect(roomDoorSpan(2 * ROOM_WALL + 8, 's')).toBeNull();
  });

  it('puts the doorway in the front wall when none is set', () => {
    expect(roomWalls(room)).toEqual(roomWalls({ ...room, roomDoor: 's' }));
  });

  it('breaks the back wall or a side wall at its doorway', () => {
    for (const door of ['n', 'e', 'w'] as const)
      expect(roomWalls({ ...room, roomDoor: door })).toHaveLength(5);
  });

  it('draws no wall of no length', () => {
    expect(roomWalls({ ...room, width: 0, height: 0, roomDoor: 'none' })).toEqual([]);
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
