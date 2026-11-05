import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { fenceSegments, fenceStalled, fenceStep } from '@liveworkspace/avatar/collision';
import { avatarFigureHeight } from '@liveworkspace/avatar/walk';
import {
  elevatorExitPoint,
  peopleKey,
  placeFinder,
  placePoints,
  spaceFloors,
  spacePlaces,
  tabPlaces,
  walkThereRoute,
  whoIsWhere,
  type WayPoint,
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

  it('steps out centred below the Elevator, the whole figure clear of its name', () => {
    const lift = { x: 40, y: 20, width: 112, height: 140 };
    const exit = elevatorExitPoint(lift);
    expect(exit.x).toBe(96);
    // The name's line runs 16px under the box (ElevatorFace); the Regular figure's head stands below it, not over it.
    const nameBottom = lift.y + lift.height + 16;
    expect(exit.y - avatarFigureHeight(1.5)).toBeGreaterThan(nameBottom);
    // A nudge, not a trip: still within a figure and a half of the doors.
    expect(exit.y - (lift.y + lift.height)).toBeLessThan(1.5 * avatarFigureHeight(1.5));
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

// The ordinary walk, as useAvatarWalk steps it: straight at each point in turn, a step at a time, fenced by the walls
// (a Regular character's 12px reach). A leg a wall stalls ends the walk, as a click-walk does.
function walk(elements: readonly Element[], from: WayPoint, route: readonly WayPoint[]): WayPoint {
  const fences = fenceSegments(elements);
  let at = from;
  for (const target of route) {
    for (let i = 0; i < 2000; i++) {
      const d = Math.hypot(target.x - at.x, target.y - at.y);
      if (d < 0.5) break;
      const step = Math.min(4, d);
      const wanted = {
        x: at.x + ((target.x - at.x) / d) * step,
        y: at.y + ((target.y - at.y) / d) * step,
      };
      const next = fenceStep(at, wanted, fences, 12);
      const moved = Math.hypot(next.pos.x - at.x, next.pos.y - at.y);
      at = next.pos;
      if (next.blocked && fenceStalled(moved, step)) return at;
    }
  }
  return at;
}

describe('walkThereRoute', () => {
  const near = (a: WayPoint, b: WayPoint) => Math.hypot(a.x - b.x, a.y - b.y) < 1;
  const below = { x: 260, y: 600 };

  it('walks round a room to a doorway in its top wall, where the straight walk stopped at the near wall', () => {
    const room = at('room', 0, 0, { width: 400, height: 300, roomDoor: 'n' });
    const [place] = tabPlaces('t', [room]);
    // The straight walk to the approach meets the bottom wall head-on.
    expect(near(walk([room], below, [place!.approach!, place!.arrival]), place!.arrival)).toBe(
      false,
    );
    const route = walkThereRoute(below, place!);
    expect(route.length).toBe(4);
    expect(route.slice(-2)).toEqual([place!.approach, place!.arrival]);
    expect(near(walk([room], below, route), place!.arrival)).toBe(true);
  });

  it('walks round a Room Builder room to a Door on its top wall', () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const room = at('room', 0, 0, { width: 400, height: 300, roomOutline: outline });
    const door = at('door', 152, -12, { width: 96, height: 24 });
    const [place] = tabPlaces('t', [room, door]);
    expect(place!.approach!.y).toBeLessThan(0);
    const route = walkThereRoute(below, place!);
    expect(near(walk([room, door], below, route), place!.arrival)).toBe(true);
  });

  it('takes the nearer way round', () => {
    const room = at('room', 0, 0, { width: 400, height: 300, roomDoor: 'n' });
    const [place] = tabPlaces('t', [room]);
    // From the lower right, round the right-hand side.
    const route = walkThereRoute({ x: 380, y: 360 }, place!);
    expect(route[0]!.x).toBeGreaterThan(400);
    expect(route[1]!.x).toBeGreaterThan(400);
  });

  it('goes straight when nothing of the place is in the way, or from inside it', () => {
    const room = at('room', 0, 0, { width: 400, height: 300, roomDoor: 'n' });
    const [place] = tabPlaces('t', [room]);
    expect(walkThereRoute({ x: 200, y: -200 }, place!)).toEqual([place!.approach, place!.arrival]);
    expect(walkThereRoute({ x: 200, y: 200 }, place!)).toEqual([place!.arrival]);
    const southern = tabPlaces('t', [at('room', 0, 0, { width: 400, height: 300 })])[0]!;
    expect(walkThereRoute(below, southern)).toEqual([southern.approach, southern.arrival]);
  });

  it('walks to a place without a doorway, and onto a stage, as before', () => {
    const none = tabPlaces('t', [at('room', 0, 0, { roomDoor: 'none' })])[0]!;
    expect(walkThereRoute(below, none)).toEqual([none.arrival]);
    const stage = tabPlaces('t', [at('stage', 0, 0)])[0]!;
    expect(stage.bounds).toBeNull();
    expect(walkThereRoute({ x: 0, y: -500 }, stage)).toEqual([stage.approach, stage.arrival]);
  });

  it('leaves an approach inside the box to the ordinary walk', () => {
    const place = {
      approach: { x: 50, y: 50 },
      arrival: { x: 60, y: 60 },
      bounds: { x: 0, y: 0, width: 100, height: 100 },
    };
    expect(walkThereRoute({ x: 50, y: 300 }, place)).toEqual([place.approach, place.arrival]);
  });

  it('falls back to the straight walk round a box with no inside', () => {
    const place = {
      approach: { x: 50, y: -10 },
      arrival: { x: 50, y: 10 },
      bounds: { x: 0, y: 0, width: 100, height: 0 },
    };
    expect(walkThereRoute({ x: 50, y: 100 }, place)).toEqual([place.approach, place.arrival]);
  });
});
