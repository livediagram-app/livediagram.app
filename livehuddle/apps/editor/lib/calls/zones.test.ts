import { describe, expect, it } from 'vitest';
import { ROOM_BACK_FACE, ROOM_WALL } from '@livehuddle/avatar/office-geometry';
import { roomZones, zoneAt, zoning } from './zones';

const room = (id: string, x: number, y: number, width = 480, height = 320) => ({
  id,
  type: 'shape',
  shape: 'room',
  x,
  y,
  width,
  height,
});

// docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls".
describe('roomZones', () => {
  it('makes a zone of each room’s floor inside its walls, and of nothing else', () => {
    const zones = roomZones([
      room('a', 0, 0),
      { id: 'rug', type: 'shape', shape: 'rug', x: 0, y: 0, width: 100, height: 100 },
      { id: 'note', type: 'sticky', x: 0, y: 0, width: 100, height: 100 },
      { id: 'line', type: 'arrow' },
      // A room with no box (never stored like this, but the walk skips it too).
      { id: 'boxless', type: 'shape', shape: 'room' },
      // Too small to stand in.
      room('tiny', 0, 0, ROOM_WALL, ROOM_BACK_FACE),
    ]);
    expect(zones).toEqual([
      {
        id: 'a',
        x0: ROOM_WALL / 2,
        y0: ROOM_BACK_FACE - ROOM_WALL / 2,
        x1: 480 - ROOM_WALL / 2,
        y1: 320 - ROOM_WALL / 2,
        area: (480 - ROOM_WALL) * (320 - ROOM_BACK_FACE),
      },
    ]);
  });
});

describe('zoneAt', () => {
  const zones = roomZones([room('hall', 0, 0, 1000, 800), room('booth', 100, 100, 200, 200)]);

  it('is the room your feet are in, the open outside every room', () => {
    expect(zoneAt({ x: 600, y: 400 }, zones)).toBe('hall');
    expect(zoneAt({ x: 1200, y: 400 }, zones)).toBeNull();
  });

  it('puts the doorway’s threshold (the walls’ centre line) outside, one step in inside', () => {
    const front = 800 - ROOM_WALL / 2;
    expect(zoneAt({ x: 500, y: front }, zones)).toBeNull();
    expect(zoneAt({ x: 500, y: front - 1 }, zones)).toBe('hall');
    expect(zoneAt({ x: ROOM_WALL / 2, y: 400 }, zones)).toBeNull();
  });

  it('picks the innermost of nested rooms, and the lower id of two the same size', () => {
    expect(zoneAt({ x: 200, y: 200 }, zones)).toBe('booth');
    const twins = roomZones([room('b', 0, 0), room('a', 0, 0)]);
    expect(zoneAt({ x: 200, y: 200 }, twins)).toBe('a');
    expect(zoneAt({ x: 200, y: 200 }, [...twins].reverse())).toBe('a');
  });
});

describe('zoning', () => {
  it('zones you and every walker once, and nobody when there are no rooms', () => {
    const zones = roomZones([room('r', 0, 0)]);
    const walkers = new Map([
      ['in', { x: 100, y: 100 }],
      ['out', { x: 900, y: 100 }],
    ]);
    const z = zoning({ x: 50, y: 100 }, walkers, zones);
    expect(z.self).toBe('r');
    expect([...z.of]).toEqual([
      ['in', 'r'],
      ['out', null],
    ]);
    expect(zoning(null, walkers, zones).self).toBeNull();
    const none = zoning({ x: 50, y: 100 }, walkers, []);
    expect(none.self).toBeNull();
    expect(none.of.size).toBe(0);
  });
});
