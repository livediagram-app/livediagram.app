import { describe, expect, it } from 'vitest';
import { roomDoorSpan, roomWalls, type Element } from '@liveplanner/document';
import { buildTemplate } from './build-template';
import { furnishRooms } from './template-office-parts';

// docs/specs/012-collaboration/virtual-office-template.md
describe('the Virtual Office template', () => {
  const els = buildTemplate('virtual-office', 0, 0);
  const shapes = (kind: string) =>
    els.filter(
      (e): e is Extract<Element, { type: 'shape' }> => e.type === 'shape' && e.shape === kind,
    );

  it('has six named rooms either side of a corridor, every doorway onto it', () => {
    const rooms = shapes('room');
    expect(rooms.map((r) => r.label)).toEqual([
      'Reception',
      'Desks',
      'Meeting Room',
      'Kitchen',
      'Lounge',
      'Focus Room',
    ]);
    const top = Math.min(...rooms.map((r) => r.y));
    for (const r of rooms) expect(r.roomDoor).toBe(r.y === top ? 's' : 'n');
  });

  it('lays the rooms and rugs under everything else', () => {
    const firstOther = els.findIndex(
      (e) => !(e.type === 'shape' && (e.shape === 'room' || e.shape === 'rug')),
    );
    const lastFloor = els.reduce(
      (at, e, i) => (e.type === 'shape' && (e.shape === 'room' || e.shape === 'rug') ? i : at),
      -1,
    );
    expect(lastFloor).toBeLessThan(firstOther);
  });

  it('furnishes them: seven desks, a meeting table, a cooler and a coffee machine, and a way in', () => {
    expect(shapes('desk')).toHaveLength(7);
    expect(shapes('meeting-table')).toHaveLength(1);
    expect(shapes('water-cooler')).toHaveLength(1);
    expect(shapes('coffee-machine')).toHaveLength(1);
    expect(shapes('mode-button')).toEqual([
      expect.objectContaining({ label: 'Walk In', mode: 'avatar' }),
    ]);
  });

  it('puts every piece inside a room, clear of its walls', () => {
    const rooms = shapes('room');
    for (const e of els) {
      if (e.type !== 'shape' || ['room', 'mode-button', 'sticker'].includes(e.shape)) continue;
      const room = rooms.find(
        (r) =>
          e.x >= r.x &&
          e.y >= r.y &&
          e.x + e.width <= r.x + r.width &&
          e.y + e.height <= r.y + r.height,
      );
      expect(room, `${e.shape} at ${e.x},${e.y}`).toBeDefined();
      // Nothing straddles a wall line a character could not then reach past.
      for (const w of roomWalls(room!)) {
        const vertical = w.a.x === w.b.x;
        if (vertical) expect(w.a.x <= e.x || w.a.x >= e.x + e.width).toBe(true);
      }
    }
  });
});

// Walking in through a doorway reaches the room: seating that catches a character the moment its feet enter it sat
// anyone who came in when it stood just inside the door.
describe('the Virtual Office layout', () => {
  const els = buildTemplate('virtual-office', 0, 0);
  type Box = Element & { x: number; y: number; width: number; height: number };
  const of = (kind: string) =>
    els.filter((e) => e.type === 'shape' && e.shape === kind) as (Box & {
      roomDoor?: 'n' | 's';
      label?: string;
    })[];
  const meets = (a: Box, b: { x: number; y: number; width: number; height: number }) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  const SEATS = ['desk', 'sofa', 'chair', 'meeting-table'];

  it('keeps every seat out of the first 80 px inside each doorway', () => {
    for (const room of of('room')) {
      const span = roomDoorSpan(room.width, room.roomDoor ?? 's')!;
      const approach = {
        x: room.x + span[0],
        width: span[1] - span[0],
        y: room.roomDoor === 'n' ? room.y : room.y + room.height - 80,
        height: 80,
      };
      for (const seat of els.filter((e) => e.type === 'shape' && SEATS.includes(e.shape)) as Box[])
        expect(
          meets(seat, approach),
          `${room.label}: ${seat.type === 'shape' ? seat.shape : ''}`,
        ).toBe(false);
    }
  });

  it('never stands one desk over another', () => {
    const desks = of('desk');
    for (const [i, a] of desks.entries())
      for (const b of desks.slice(i + 1))
        expect(meets(a, b), `${a.x},${a.y} / ${b.x},${b.y}`).toBe(false);
  });

  it('puts every sofa on a rug', () => {
    for (const sofa of of('sofa')) expect(of('rug').some((rug) => meets(sofa, rug))).toBe(true);
  });

  it('ends both rows of rooms at the same edge', () => {
    const rooms = of('room');
    const top = Math.min(...rooms.map((r) => r.y));
    const right = (row: typeof rooms) => Math.max(...row.map((r) => r.x + r.width));
    expect(right(rooms.filter((r) => r.y !== top))).toBe(right(rooms.filter((r) => r.y === top)));
  });
});

// docs/specs/012-collaboration/virtual-office-template.md "Spaces"
describe('the space templates', () => {
  const build = (kind: 'coworking-space' | 'team-pod' | 'all-hands-hall') =>
    buildTemplate(kind, 0, 0);
  const count = (els: Element[], shape: string) =>
    els.filter((e) => e.type === 'shape' && e.shape === shape).length;

  it('each lays its floors first and gives a way in', () => {
    for (const kind of ['coworking-space', 'team-pod', 'all-hands-hall'] as const) {
      const els = build(kind);
      const isFloor = (e: Element) =>
        e.type === 'shape' && (e.shape === 'room' || e.shape === 'rug');
      const firstOther = els.findIndex((e) => !isFloor(e));
      expect(els.slice(firstOther).some(isFloor), kind).toBe(false);
      expect(count(els, 'mode-button'), kind).toBe(1);
    }
  });

  it('opens each booth onto floor wide enough to walk', () => {
    const els = build('coworking-space');
    const rooms = els.filter((e) => e.type === 'shape' && e.shape === 'room') as (Element & {
      x: number;
      y: number;
      width: number;
      height: number;
      label: string;
      roomDoor?: 'n' | 's' | 'e' | 'w';
    })[];
    const walls = rooms.flatMap((r) => roomWalls(r));
    // Distance from a point to a wall segment.
    const dist = (p: { x: number; y: number }, w: (typeof walls)[number]) => {
      const [dx, dy] = [w.b.x - w.a.x, w.b.y - w.a.y];
      const t = Math.max(
        0,
        Math.min(1, ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / (dx * dx + dy * dy || 1)),
      );
      return Math.hypot(p.x - (w.a.x + t * dx), p.y - (w.a.y + t * dy));
    };
    for (const booth of rooms.filter((r) => r.label.startsWith('Booth'))) {
      // A step of 60 px out through the doorway, from its middle: clear of every wall by a Tall character's reach.
      const step = { n: [0, -60], s: [0, 60], e: [60, 0], w: [-60, 0] }[booth.roomDoor ?? 's'];
      const mid = {
        n: { x: booth.x + booth.width / 2, y: booth.y },
        s: { x: booth.x + booth.width / 2, y: booth.y + booth.height },
        e: { x: booth.x + booth.width, y: booth.y + booth.height / 2 },
        w: { x: booth.x, y: booth.y + booth.height / 2 },
      }[booth.roomDoor ?? 's'];
      const outside = { x: mid.x + step[0]!, y: mid.y + step[1]! };
      expect(Math.min(...walls.map((w) => dist(outside, w))), booth.label).toBeGreaterThan(24);
    }
  });

  it('gives the coworking space eight desks and two single-seat booths', () => {
    const els = build('coworking-space');
    expect(count(els, 'desk')).toBe(8);
    const rooms = els.filter((e) => e.type === 'shape' && e.shape === 'room').map((e) => e.label);
    expect(rooms).toEqual(['Coworking', 'Booth 1', 'Booth 2']);
  });

  it('gives the team pod four desks, a table and a board of four stickies', () => {
    const els = build('team-pod');
    // The way in waits under the pod, where its door is, not under the board beside it.
    const pod = els.find((e) => e.type === 'shape' && e.shape === 'room') as Element & {
      x: number;
      width: number;
    };
    const walk = els.find((e) => e.type === 'shape' && e.shape === 'mode-button') as Element & {
      x: number;
      width: number;
    };
    expect(walk.x + walk.width).toBeLessThanOrEqual(pod.x + pod.width);
    expect(count(els, 'desk')).toBe(4);
    expect(count(els, 'meeting-table')).toBe(1);
    expect(els.filter((e) => e.type === 'sticky')).toHaveLength(4);
  });

  it('seats thirty-two facing the stage in the all-hands hall, with Bring Focus', () => {
    const els = build('all-hands-hall');
    const chairs = els.filter((e) => e.type === 'shape' && e.shape === 'chair');
    expect(chairs).toHaveLength(32);
    expect(chairs.every((c) => c.type === 'shape' && c.chairFacing === 's')).toBe(true);
    expect(count(els, 'focus-button')).toBe(1);
    // A raised hand is Behaviour › Wave, which everyone sees; a Reactions burst plays on its sender's screen only.
    const hint = els.find((e) => e.type === 'text' && /take a seat/.test(e.label ?? ''));
    expect(hint?.label).toMatch(/Wave/);
    expect(hint?.label).not.toMatch(/reactions/i);
  });
});

describe('furnishRooms', () => {
  it('keeps a piece given one side to its drawing’s proportion', () => {
    const [, rug] = furnishRooms(
      [
        {
          name: 'R',
          x: 0,
          y: 0,
          w: 600,
          h: 400,
          door: 's',
          pieces: [{ kind: 'rug', x: 10, y: 10, w: 400 }],
        },
      ],
      0,
      0,
    ) as (Element & { width: number; height: number })[];
    expect(rug!.width).toBe(400);
    expect(rug!.height).toBe(240);
  });
});
