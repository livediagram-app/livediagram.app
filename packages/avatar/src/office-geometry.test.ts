import { describe, expect, it } from 'vitest';
import {
  boxEdges,
  DRINK_KINDS,
  drinkFrom,
  isDrinkKind,
  isFixedSeatShape,
  isFloorShape,
  isRoomDoor,
  isSceneryShape,
  isSeatingShape,
  seatsACharacter,
  officeFootprint,
  ROOM_BACK_FACE,
  ROOM_DOOR_WIDTH,
  ROOM_WALL,
  roomDoorSpan,
  roomInterior,
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
    expect(['room', 'rug', 'avatar-pad', 'stage'].every(isFloorShape)).toBe(true);
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

  it('has its floor inside the walls’ centre lines, the doorway’s threshold included', () => {
    const inside = roomInterior(room);
    const walls = roomWalls({ ...room, roomDoor: 's' });
    // The same lines the walls run along: the side walls' x, the back wall's foot and the front wall's (doorway) y.
    const vertical = walls.filter((w) => w.a.x === w.b.x).map((w) => w.a.x);
    const horizontal = walls.filter((w) => w.a.y === w.b.y).map((w) => w.a.y);
    expect(inside.x).toBe(Math.min(...vertical));
    expect(inside.x + inside.width).toBe(Math.max(...vertical));
    expect(inside.y).toBe(Math.min(...horizontal));
    expect(inside.y + inside.height).toBe(Math.max(...horizontal));
    expect(inside).toEqual({
      x: room.x + ROOM_WALL / 2,
      y: room.y + ROOM_BACK_FACE - ROOM_WALL / 2,
      width: room.width - ROOM_WALL,
      height: room.height - ROOM_BACK_FACE,
    });
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

// livehuddle's docs/specs/009-elements/office.md "Office Pod" to "Garden Fence".
describe('the pod, the bar and the garden', () => {
  it('lays a garden path and grass on the floor', () => {
    expect(isFloorShape('garden-path')).toBe(true);
    expect(isFloorShape('grass')).toBe(true);
    expect(isFloorShape('garden-fence')).toBe(false);
  });

  it('seats a character in a pod and on a bar stool, which never turn', () => {
    expect(isFixedSeatShape('office-pod')).toBe(true);
    expect(isFixedSeatShape('bar-stool')).toBe(true);
    expect(isFixedSeatShape('chair')).toBe(false);
    expect(isSeatingShape('office-pod')).toBe(false);
    expect(seatsACharacter('office-pod')).toBe(true);
    expect(seatsACharacter('sofa')).toBe(true);
    expect(seatsACharacter('bar')).toBe(false);
  });

  it('gives juice at the cabinet and soda at the fridge, and accepts only known drinks', () => {
    expect(drinkFrom('drinks-cabinet')).toBe('juice');
    expect(drinkFrom('drinks-fridge')).toBe('soda');
    expect(DRINK_KINDS).toEqual(['water', 'coffee', 'juice', 'soda']);
    expect(isDrinkKind('soda')).toBe(true);
    expect(isDrinkKind('wine')).toBe(false);
    expect(isDrinkKind(null)).toBe(false);
  });

  it('blocks with the bar’s counter, the planter and the trunk’s base, never the canopy', () => {
    const tree = officeFootprint({ shape: 'tree', x: 0, y: 0, width: 120, height: 160 })!;
    expect(tree.x).toBeCloseTo(48);
    expect(tree.y).toBeCloseTo(136);
    expect(tree.width).toBeCloseTo(24);
    expect(tree.height).toBeCloseTo(16);
    const bar = officeFootprint({ shape: 'bar', x: 0, y: 0, width: 240, height: 120 })!;
    expect(bar.y).toBe(60);
    const planter = officeFootprint({ shape: 'outdoor-plant', x: 0, y: 0, width: 72, height: 80 })!;
    expect(planter.x).toBeCloseTo(14);
    expect(planter.width).toBeCloseTo(44);
    expect(planter.y).toBeCloseTo(56);
    expect(planter.height).toBeCloseTo(20);
    for (const kind of ['plant', 'bookshelf', 'bar', 'outdoor-plant', 'tree'])
      expect(isSceneryShape(kind)).toBe(true);
    expect(isSceneryShape('drinks-fridge')).toBe(false);
  });
});
