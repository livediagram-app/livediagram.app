import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import {
  elevatorExitPoint,
  peopleKey,
  placeFinder,
  placePoints,
  spaceFloors,
  spacePlaces,
  tabPlaces,
  whoIsWhere,
} from './wayfinding';

const at = (kind: Parameters<typeof createShape>[0], x: number, y: number, over = {}) =>
  ({ ...createShape(kind, x, y), id: `${kind}-${x}-${y}`, ...over }) as Element;

describe('tabPlaces', () => {
  it('lists rooms, pods and stages in reading order, numbering only the unnamed', () => {
    const elements = [
      at('room', 600, 0, { label: '' }),
      at('room', 0, 0, { label: '' }),
      at('room', 0, 500, { label: 'Design' }),
      at('office-pod', 0, 900),
      at('stage', 600, 900, { label: '  ' }),
      at('plant', 10, 10),
    ];
    const places = tabPlaces('t1', elements);
    expect(places.map((p) => p.name)).toEqual([
      'Room 1',
      'Room 2',
      'Design',
      'Office Pod 1',
      'Stage 1',
    ]);
    expect(places.map((p) => p.kind)).toEqual(['room', 'room', 'room', 'pod', 'stage']);
    expect(places.every((p) => p.tabId === 't1')).toBe(true);
  });

  it('is empty for a tab without places', () => {
    expect(tabPlaces('t', [at('plant', 0, 0)])).toEqual([]);
  });
});

describe('placePoints', () => {
  it('approaches a bottom doorway from outside and arrives inside', () => {
    const room = at('room', 0, 0, { roomDoor: 's' }) as never as Parameters<typeof placePoints>[0];
    const { approach, arrival } = placePoints(room, []);
    expect(approach!.y).toBeGreaterThan(room.y + room.height);
    expect(arrival.y).toBeLessThan(room.y + room.height);
    expect(approach!.x).toBe(arrival.x);
  });

  it.each(['n', 'e', 'w'] as const)('puts the approach outside a %s doorway', (door) => {
    const room = at('room', 0, 0, { roomDoor: door }) as never as Parameters<typeof placePoints>[0];
    const { approach, arrival } = placePoints(room, []);
    const inside = (p: { x: number; y: number }) =>
      p.x > room.x && p.x < room.x + room.width && p.y > room.y && p.y < room.y + room.height;
    expect(inside(approach!)).toBe(false);
    expect(inside(arrival)).toBe(true);
  });

  it('walks to the centre of a room with no doorway', () => {
    const room = at('room', 0, 0, { roomDoor: 'none' }) as never as Parameters<
      typeof placePoints
    >[0];
    expect(placePoints(room, []).approach).toBeNull();
  });

  it('uses the door on a Room Builder room, arriving inside its outline', () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const room = at('room', 0, 0, { width: 400, height: 300, roomOutline: outline });
    const door = at('door', 152, 288, { width: 96, height: 24 });
    const { approach, arrival } = placePoints(room as never, [room, door]);
    expect(approach!.y).toBeGreaterThan(300);
    expect(arrival.y).toBeLessThan(300);
    const bare = placePoints(room as never, [room]);
    expect(bare.approach).toBeNull();
    expect(bare.arrival).toEqual({ x: 200, y: 150 });
  });

  it('arrives on a stage top from its front, and in a pod through its door', () => {
    const stage = at('stage', 0, 0) as never as Parameters<typeof placePoints>[0];
    const s = placePoints(stage, []);
    expect(s.approach!.y).toBeGreaterThan(stage.y + stage.height);
    expect(s.arrival.y).toBeLessThan(stage.y + stage.height);
    const pod = at('office-pod', 0, 0) as never as Parameters<typeof placePoints>[0];
    const p = placePoints(pod, []);
    expect(p.approach!.y).toBeGreaterThan(p.arrival.y);
  });
});

describe('who is where', () => {
  const room = at('room', 0, 0, { label: 'Design' });
  const stage = at('stage', 1000, 0);

  it('puts feet in a stage first, then a room, else Around', () => {
    const find = placeFinder([room, stage]);
    expect(find({ x: 200, y: 150 })).toBe(room.id);
    expect(find({ x: 1100, y: 40 })).toBe(stage.id);
    expect(find({ x: 800, y: 800 })).toBeNull();
    expect(placeFinder([])({ x: 0, y: 0 })).toBeNull();
  });

  it('places the self and peers on this tab, and the tab bar people elsewhere', () => {
    const people = whoIsWhere({
      activeTabId: 'a',
      findPlace: placeFinder([room]),
      self: { id: 'me', name: 'Me', color: '#000', feet: { x: 200, y: 150 } },
      peers: [{ id: 'p', name: 'Pat', color: '#111', feet: { x: 900, y: 900 } }],
      byTab: new Map([
        [
          'a',
          [
            { id: 'me', name: 'Me', color: '#000' },
            { id: 'q', name: 'Quin', color: '#222' },
          ],
        ],
        ['b', [{ id: 'r', name: 'Rae', color: '#333' }]],
      ]),
    });
    expect(people.map((p) => [p.id, p.tabId, p.placeId])).toEqual([
      ['me', 'a', room.id],
      ['p', 'a', null],
      ['q', 'a', null],
      ['r', 'b', null],
    ]);
    expect(people[0]!.self).toBe(true);
  });

  it('keys by value: a step inside one room keeps the key', () => {
    const find = placeFinder([room]);
    const run = (x: number) =>
      peopleKey(
        whoIsWhere({
          activeTabId: 'a',
          findPlace: find,
          self: { id: 'me', name: 'Me', color: '#000', feet: { x, y: 150 } },
          peers: [],
          byTab: new Map(),
        }),
      );
    expect(run(100)).toBe(run(300));
    expect(run(100)).not.toBe(run(900));
  });
});

describe('spaceFloors', () => {
  it('lists each tab with its Elevators in reading order and where it arrives', () => {
    const tabs = [
      {
        id: 'a',
        name: 'Lobby',
        elements: [at('elevator', 500, 0), at('elevator', 0, 0)],
      },
      { id: 'b', name: 'Roof', elements: [at('avatar-pad', 100, 100)] },
      { id: 'c', name: 'Garden', elements: [at('plant', 100, 100)] },
      { id: 'd', name: 'Empty', elements: [] },
    ];
    const floors = spaceFloors(tabs);
    expect(floors[0]!.elevators.map((e) => [e.id, e.name])).toEqual([
      ['elevator-0-0', 'Elevator 1'],
      ['elevator-500-0', 'Elevator 2'],
    ]);
    expect(floors[0]!.arrival).toEqual(floors[0]!.elevators[0]!.exit);
    expect(floors.map((f) => f.arrivesAt)).toEqual(['elevator', 'pad', 'middle', 'middle']);
    expect(floors[3]!.arrival).toEqual({ x: 0, y: 0 });
  });

  it('steps out below the Elevator, centred', () => {
    expect(elevatorExitPoint({ x: 0, y: 0, width: 112, height: 140 })).toEqual({ x: 56, y: 176 });
  });

  it('groups places per tab in tab order', () => {
    const groups = spacePlaces([
      { id: 'a', name: 'A', elements: [at('room', 0, 0)] },
      { id: 'b', name: 'B', elements: [] },
    ]);
    expect(groups.map((g) => [g.tab.id, g.places.length])).toEqual([
      ['a', 1],
      ['b', 0],
    ]);
  });
});
