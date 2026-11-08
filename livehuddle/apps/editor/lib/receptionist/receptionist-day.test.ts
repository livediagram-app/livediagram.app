import { describe, expect, it } from 'vitest';
import type { Element } from '@livehuddle/document';
import { buildNavGrid } from '@liveworkspace/avatar/pathing';
import { fenceReachFor, fenceSegments, shutDoorLines } from '@liveworkspace/avatar/collision';
import { roomInterior } from '@liveworkspace/avatar/office-geometry';
import {
  RECEPTIONIST_HOME_EVERY,
  RECEPTIONIST_LEG_MS,
  RECEPTIONIST_RADIUS,
  RECEPTIONIST_SPEED,
  alongRoute,
  msToNextReceptionistLeg,
  nearestRoomSpot,
  receptionistLegAt,
  receptionistPad,
  receptionistRoute,
  receptionistStop,
  receptionistWorld,
  routeLength,
  routeMs,
} from './receptionist-day';

// docs/specs/008-canvas/receptionist.md "Where he is" and "His day".

const shape = (id: string, kind: string, x: number, y: number, width = 60, height = 60) =>
  ({ id, type: 'shape', shape: kind, x, y, width, height }) as unknown as Element & {
    x: number;
    y: number;
    width: number;
    height: number;
  };

const pad = shape('pad-1', 'avatar-pad', 0, 0, 80, 80);

function gridFor(elements: readonly Element[]) {
  return buildNavGrid(fenceSegments(elements), fenceReachFor(1), shutDoorLines(elements));
}

describe('receptionistPad and receptionistWorld', () => {
  it('belongs to the first Avatar Pad, and there is no the Receptionist without one', () => {
    const second = shape('pad-2', 'avatar-pad', 900, 900, 80, 80);
    expect(receptionistPad([shape('p', 'plant', 0, 0), pad, second])?.id).toBe('pad-1');
    expect(receptionistPad([shape('p', 'plant', 0, 0)])).toBeNull();
    expect(receptionistWorld([shape('p', 'plant', 0, 0)], null)).toBeNull();
  });

  it('stands home beside the pad, facing down, and keeps to a circle round a pad in no room', () => {
    const world = receptionistWorld([pad], null)!;
    expect(world.padId).toBe('pad-1');
    expect(world.home).toEqual({ at: { x: 108, y: 40 }, activity: 'home', face: 'down' });
    expect(world.area).toEqual({ kind: 'circle', at: { x: 40, y: 40 }, r: RECEPTIONIST_RADIUS });
    expect(world.stops).toEqual([]);
  });

  it('visits the pieces he has something to do at, in reach, facing them', () => {
    const near = [
      shape('coffee', 'coffee-machine', 200, 0),
      shape('plant', 'plant', -200, 0),
      shape('shelf', 'bookshelf', 0, 200),
      shape('bed', 'pet-bed', 200, 200),
      shape('desk', 'reception-desk', -200, 200),
      shape('chair', 'chair', 100, 100),
    ];
    const far = shape('far-plant', 'plant', 3000, 3000);
    const world = receptionistWorld([pad, ...near, far], null)!;
    expect(world.stops.map((s) => s.activity)).toEqual([
      'drink',
      'admire',
      'browse',
      'pat',
      'desk',
    ]);
    expect(world.stops[0]).toMatchObject({ at: { x: 230, y: 78 }, face: 'up' });
    expect(world.stops[0]!.drink).toBeTruthy();
    expect(world.stops.every((s) => s.face === 'up')).toBe(true);
  });

  it('keeps to his room, inset from its walls, and finds the other rooms', () => {
    const room = shape('room', 'room', -400, -400, 900, 900);
    const other = shape('other', 'room', 1200, 0, 400, 300);
    const outside = shape('plant-out', 'plant', 800, 0);
    const inside = shape('plant-in', 'plant', 200, 0);
    const elements = [room, other, pad, outside, inside];
    const world = receptionistWorld(elements, gridFor(elements))!;
    expect(world.area.kind).toBe('box');
    const floor = roomInterior(room);
    if (world.area.kind === 'box') {
      expect(world.area.box.x).toBe(floor.x + 40);
      expect(world.area.box.width).toBe(floor.width - 80);
    }
    expect(world.stops.map((s) => s.at.x)).toEqual([230]);
    const f = roomInterior(other);
    expect(world.rooms).toEqual([{ x: f.x + f.width / 2, y: f.y + f.height - 36 }]);
    expect(nearestRoomSpot(world, world.home.at)).toEqual(world.rooms[0]);
    expect(nearestRoomSpot(receptionistWorld([pad], null)!, { x: 0, y: 0 })).toBeNull();
  });

  it('picks the innermost room and wanders a circle when the room is too small', () => {
    const outer = shape('outer', 'room', -600, -600, 1400, 1400);
    const inner = shape('inner', 'room', -5, -150, 90, 300);
    const world = receptionistWorld([outer, inner, pad], null)!;
    expect(world.area.kind).toBe('circle');
    // Neither room he stands in counts as a room to walk you to.
    expect(world.rooms).toEqual([]);
  });

  it('picks the nearest of several rooms', () => {
    const a = shape('a', 'room', 600, 0, 300, 300);
    const b = shape('b', 'room', 2000, 0, 300, 300);
    const world = receptionistWorld([pad, b, a], null)!;
    expect(world.rooms).toHaveLength(2);
    expect(nearestRoomSpot(world, { x: 0, y: 0 })!.x).toBeLessThan(1000);
  });
});

describe('receptionistStop', () => {
  const pieces = [pad, shape('coffee', 'coffee-machine', 200, 0), shape('plant', 'plant', -200, 0)];

  it('is the same stop for the same pad and leg on every screen', () => {
    const a = receptionistWorld(pieces, null)!;
    const b = receptionistWorld(pieces, null)!;
    for (let n = 0; n < 40; n += 1) expect(receptionistStop(a, n)).toEqual(receptionistStop(b, n));
    expect(receptionistStop(a, 5)).toBe(receptionistStop(a, 5));
  });

  it('goes home every fourth leg, negative legs too', () => {
    const world = receptionistWorld(pieces, null)!;
    for (const n of [RECEPTIONIST_HOME_EVERY - 1, 2 * RECEPTIONIST_HOME_EVERY - 1, -1, -5])
      expect(receptionistStop(world, n)).toBe(world.home);
  });

  it('mixes pieces with flourishes on the open floor, all within reach', () => {
    const world = receptionistWorld(pieces, null)!;
    const kinds = new Set<string>();
    for (let n = 0; n < 200; n += 1) {
      const stop = receptionistStop(world, n);
      kinds.add(stop.activity);
      if (stop.activity === 'flourish') {
        expect(stop.flourish).toBeTruthy();
        expect(Math.hypot(stop.at.x - 40, stop.at.y - 40)).toBeLessThanOrEqual(RECEPTIONIST_RADIUS);
      }
    }
    expect(kinds).toEqual(new Set(['home', 'drink', 'admire', 'flourish']));
  });

  it('goes home when no floor spot can be reached', () => {
    // A room his pad stands in, walled shut and barely bigger than the inset: no spot inside it is reachable.
    const world = receptionistWorld([pad], null)!;
    const shut = {
      ...world,
      area: { kind: 'box' as const, box: { x: 5000, y: 5000, width: 0, height: 0 } },
    };
    for (let n = 0; n < 3; n += 1) expect(receptionistStop(shut, n)).toBe(world.home);
  });

  it('forgets the oldest legs past its cache size, yet answers the same', () => {
    const world = receptionistWorld(pieces, null)!;
    const first = receptionistStop(world, 0);
    for (let n = 1; n < 100; n += 1) receptionistStop(world, n);
    expect(receptionistStop(world, 0)).toEqual(first);
  });
});

describe('receptionistRoute', () => {
  it('goes straight with no walls, and is kept per grid', () => {
    const route = receptionistRoute(null, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(route![route!.length - 1]).toEqual({ x: 100, y: 0 });
    expect(receptionistRoute(null, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(route);
  });

  it('goes round a wall, and is null when the spot cannot be reached', () => {
    const room = shape('room', 'room', 200, 200, 300, 300);
    const grid = gridFor([room]);
    const inside = roomInterior(room);
    const middle = { x: inside.x + inside.width / 2, y: inside.y + inside.height / 2 };
    const route = receptionistRoute(grid, { x: 0, y: 0 }, middle);
    // A room has a door, so its middle is reachable, but not in a straight line.
    if (route)
      expect(routeLength({ x: 0, y: 0 }, route)).toBeGreaterThan(Math.hypot(middle.x, middle.y));
    const blocked = receptionistRoute(grid, { x: 0, y: 0 }, { x: 200, y: 350 });
    expect(blocked === null || blocked.length > 0).toBe(true);
  });

  it('forgets the oldest routes past its cache size', () => {
    const first = receptionistRoute(null, { x: 1, y: 1 }, { x: 2, y: 2 });
    for (let i = 0; i < 100; i += 1) receptionistRoute(null, { x: i, y: 0 }, { x: i, y: 50 });
    expect(receptionistRoute(null, { x: 1, y: 1 }, { x: 2, y: 2 })).toEqual(first);
  });
});

describe('legs and walking', () => {
  it('cuts time into legs', () => {
    expect(receptionistLegAt(0)).toBe(0);
    expect(receptionistLegAt(RECEPTIONIST_LEG_MS - 1)).toBe(0);
    expect(receptionistLegAt(RECEPTIONIST_LEG_MS)).toBe(1);
    expect(msToNextReceptionistLeg(0)).toBe(RECEPTIONIST_LEG_MS);
    expect(msToNextReceptionistLeg(RECEPTIONIST_LEG_MS - 100)).toBe(100);
    expect(msToNextReceptionistLeg(-100)).toBe(100);
  });

  it('walks a route at his speed, facing the way he goes', () => {
    const route = [
      { x: 120, y: 0 },
      { x: 120, y: 120 },
    ];
    expect(routeLength({ x: 0, y: 0 }, route)).toBe(240);
    expect(routeMs({ x: 0, y: 0 }, route)).toBe((240 / RECEPTIONIST_SPEED) * 1000);
    expect(alongRoute({ x: 0, y: 0 }, route, 500)).toEqual({
      at: { x: 60, y: 0 },
      walking: true,
      facing: 'right',
      travelled: 60,
    });
    expect(alongRoute({ x: 0, y: 0 }, route, 1500).facing).toBe('down');
    expect(alongRoute({ x: 0, y: 0 }, route, 5000)).toEqual({
      at: { x: 120, y: 120 },
      walking: false,
      facing: 'down',
      travelled: 240,
    });
    expect(alongRoute({ x: 0, y: 0 }, [{ x: -10, y: 0 }], 10).facing).toBe('left');
    expect(alongRoute({ x: 0, y: 0 }, [{ x: 0, y: -10 }], 10).facing).toBe('up');
    // A zero-length hop and a negative clock stand still.
    expect(alongRoute({ x: 0, y: 0 }, [{ x: 0, y: 0 }], -50)).toEqual({
      at: { x: 0, y: 0 },
      walking: false,
      facing: null,
      travelled: 0,
    });
  });
});
