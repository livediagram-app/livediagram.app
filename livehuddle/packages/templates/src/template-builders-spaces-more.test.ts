import { describe, expect, it } from 'vitest';
import {
  doorOnRoom,
  isFloorShape,
  roomDoorSpan,
  roomWalls,
  seatsACharacter,
  type Element,
} from '@livehuddle/document';
import { AVATAR_WIDTH } from '@liveworkspace/avatar/walk';
import { avatarScale } from '@liveworkspace/avatar/config';
import { buildTemplate } from './build-template';
import { templateFloors } from './template-floors';
import { templateCategory } from './template-categories';
import { TEMPLATES, type TemplateKind } from './templates';

// docs/specs/012-collaboration/virtual-office-template.md "Spaces", docs/specs/007-editor/templates-by-mode.md
// "Testing": every Space is walkable. Its floors lie first, it has one Walk In, every piece in a room sits inside its
// walls and every piece outside one stays clear of them, no seat stands in a doorway's first 80 px, and no two pieces
// of furniture stand on each other.

type Box = { x: number; y: number; width: number; height: number };

// An aisle: two Regular characters side by side, and no catch distance (a seat catches only feet inside it).
const TEMPLATE_AISLE = 2 * AVATAR_WIDTH * avatarScale('regular');
// The Spaces laid out to the aisle rule (docs/specs/007-editor/templates-by-mode.md "Every Space is roomy").
const ROOMY: readonly string[] = [
  'all-hands-hall',
  'training-room',
  'virtual-office',
  'coworking-space',
  'team-pod',
  'focus-library',
  'rooftop-bar',
  'cafe',
  'garden-retreat',
  'city-park',
  'company-campus',
  'conference-venue',
  'startup-hq',
  'school-quad',
  'hotel-and-suites',
  'coworking-tower',
  'expo-hall',
  'beach-offsite',
];
// Seats this close side by side are one row.
const ROW_GAP = 16;
type Shape = Extract<Element, { type: 'shape' }>;

const SPACES = TEMPLATES.map((t) => t.kind).filter((k) => templateCategory(k) !== null);
// Every Space's tabs: its first, then a building's other floors (docs/specs/007-editor/templates-by-mode.md "A
// template with floors"), each held to the same rules; only the first has the Walk In.
const TABS: [string, TemplateKind, () => Element[], boolean][] = SPACES.flatMap((kind) => [
  [kind, kind, () => buildTemplate(kind, 0, 0), true] as [
    string,
    TemplateKind,
    () => Element[],
    boolean,
  ],
  ...templateFloors(kind).map(
    (f) =>
      [`${kind} ${f.name}`, kind, () => f.build(0, 0), false] as [
        string,
        TemplateKind,
        () => Element[],
        boolean,
      ],
  ),
]);
const SEATS = [
  'desk',
  'sofa',
  'chair',
  'meeting-table',
  'bar-stool',
  'office-pod',
  'bench',
  'picnic-table',
  'hammock',
  'ping-pong-table',
];
// Shapes that are no furniture to bump into: the walls, their doors, the floors, the way in and the heading's sticker.
const NOT_FURNITURE = ['room', 'door', 'mode-button', 'sticker', 'focus-button'];

const meets = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (a: Box, b: Box) =>
  a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
const shapes = (els: Element[]) => els.filter((e): e is Shape => e.type === 'shape');

// The wall a room's Door piece stands on (docs/specs/009-elements/office.md "The doorway is a Door"), or 'none'.
function doorSide(
  room: Extract<Element, { type: 'shape' }>,
  els: readonly Element[],
): 'n' | 's' | 'e' | 'w' | 'none' {
  const door = els.find(
    (e): e is Extract<Element, { type: 'shape' }> => e.type === 'shape' && doorOnRoom(e, room),
  );
  if (!door) return 'none';
  const cx = door.x + door.width / 2;
  const cy = door.y + door.height / 2;
  const gaps = {
    n: Math.abs(cy - room.y),
    s: Math.abs(cy - (room.y + room.height)),
    w: Math.abs(cx - room.x),
    e: Math.abs(cx - (room.x + room.width)),
  };
  return (Object.keys(gaps) as (keyof typeof gaps)[]).reduce((a, b) => (gaps[b] < gaps[a] ? b : a));
}

describe.each(TABS)('the %s Space', (_name, kind, build, first) => {
  const els = build();
  const all = shapes(els);
  const rooms = all.filter((e) => e.shape === 'room');
  const furniture = all.filter((e) => !NOT_FURNITURE.includes(e.shape) && !isFloorShape(e.shape));

  it('gives every room a Door piece instead of a doorway of its own', () => {
    for (const room of rooms) {
      expect(room.roomDoor, room.label).toBe('none');
      expect(doorSide(room, els), room.label).not.toBe('none');
    }
  });

  it('lays every floor before anything else, and has one Walk In', () => {
    const isFloor = (e: Element) => e.type === 'shape' && isFloorShape(e.shape);
    const firstOther = els.findIndex((e) => !isFloor(e));
    expect(els.slice(firstOther).some(isFloor)).toBe(false);
    expect(all.filter((e) => e.shape === 'mode-button')).toEqual(
      first ? [expect.objectContaining({ label: 'Walk In' })] : [],
    );
  });

  it('keeps every piece in a room inside its walls, and every other piece clear of them', () => {
    for (const piece of [...furniture, ...all.filter((e) => e.shape === 'rug')]) {
      const at = `${piece.shape} at ${piece.x},${piece.y}`;
      const middle = {
        x: piece.x + piece.width / 2,
        y: piece.y + piece.height / 2,
        width: 0,
        height: 0,
      };
      const room = rooms.find((r) => inside(middle, r));
      if (room) {
        expect(inside(piece, room), at).toBe(true);
        continue;
      }
      for (const r of rooms) {
        for (const w of roomWalls(r)) {
          const wall = {
            x: Math.min(w.a.x, w.b.x) - 5,
            y: Math.min(w.a.y, w.b.y) - 5,
            width: Math.abs(w.a.x - w.b.x) + 10,
            height: Math.abs(w.a.y - w.b.y) + 10,
          };
          expect(meets(piece, wall), `${at} meets ${r.label}'s wall`).toBe(false);
        }
      }
    }
  });

  it('keeps every seat out of the first 80 px inside each doorway', () => {
    for (const room of rooms) {
      const door = doorSide(room, els);
      if (door === 'none') continue;
      const along = door === 'n' || door === 's' ? room.width : room.height;
      const span = roomDoorSpan(along, door)!;
      const approach =
        door === 'n' || door === 's'
          ? {
              x: room.x + span[0],
              width: span[1] - span[0],
              y: door === 'n' ? room.y : room.y + room.height - 80,
              height: 80,
            }
          : {
              y: room.y + span[0],
              height: span[1] - span[0],
              x: door === 'w' ? room.x : room.x + room.width - 80,
              width: 80,
            };
      for (const seat of all.filter((e) => SEATS.includes(e.shape)))
        expect(meets(seat, approach), `${room.label}: ${seat.shape} at ${seat.x},${seat.y}`).toBe(
          false,
        );
    }
  });

  // docs/specs/007-editor/templates-by-mode.md "Every Space is roomy".
  it('keeps every aisle between seats wide enough to walk', () => {
    // The ten Spaces respaced for it; a Space added since adopts the rule when it is laid out.
    if (!ROOMY.includes(kind)) return;
    const seats = all.filter((e) => seatsACharacter(e.shape));
    for (const [i, a] of seats.entries())
      for (const b of seats.slice(i + 1)) {
        const gx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
        const gy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
        const at = `${a.shape} at ${a.x},${a.y} / ${b.shape} at ${b.x},${b.y}`;
        // Only neighbours: a seat standing in the gap between the two makes it no aisle.
        const span = (lo: number, hi: number, d: number) =>
          d >= 0 ? [hi, Math.max(d, 1)] : [lo, Math.max(-d, 1)];
        const [x, width] = span(Math.max(a.x, b.x), Math.min(a.x + a.width, b.x + b.width), gx);
        const [y, height] = span(Math.max(a.y, b.y), Math.min(a.y + a.height, b.y + b.height), gy);
        const gap = { x: x!, y: y!, width: width!, height: height! };
        const between = seats.some((c) => c !== a && c !== b && meets(c, gap));
        if (between) continue;
        // Side by side: one row, or an aisle apart.
        if (gy < 0 && gx >= 0)
          expect(gx <= ROW_GAP || gx >= TEMPLATE_AISLE, `${at}: ${gx}`).toBe(true);
        // One behind the other: sharing an edge, or an aisle apart.
        if (gx < 0 && gy >= 0) expect(gy === 0 || gy >= TEMPLATE_AISLE, `${at}: ${gy}`).toBe(true);
      }
  });

  it('never stands one piece of furniture on another', () => {
    // A fence run may meet the next at a corner; nothing else may touch.
    const solid = furniture.filter((e) => e.shape !== 'garden-fence' && e.shape !== 'fence');
    // A microwave or a kettle stands on a kitchen unit's worktop (docs/specs/009-elements/office-amenities.md).
    const onWorktop = (a: Shape, b: Shape) =>
      ['microwave', 'kettle'].includes(a.shape) &&
      ['kitchen-counter', 'kitchen-sink'].includes(b.shape);
    // Stage Curtains hang over a stage, so a podium stands under them (docs/specs/009-elements/venue-pieces.md).
    const underCurtains = (a: Shape, b: Shape) =>
      a.shape === 'podium' && b.shape === 'stage-curtains';
    const hung = (a: Shape, b: Shape) =>
      onWorktop(a, b) || onWorktop(b, a) || underCurtains(a, b) || underCurtains(b, a);
    for (const [i, a] of solid.entries())
      for (const b of solid.slice(i + 1))
        if (!hung(a, b))
          expect(meets(a, b), `${a.shape} at ${a.x},${a.y} / ${b.shape} at ${b.x},${b.y}`).toBe(
            false,
          );
    // And nothing stands on a fence.
    for (const fence of furniture.filter((e) => e.shape === 'garden-fence'))
      for (const piece of solid)
        expect(meets(fence, piece), `${piece.shape} at ${piece.x},${piece.y} on a fence`).toBe(
          false,
        );
  });

  it('puts every sofa on a rug or out on open ground', () => {
    for (const sofa of all.filter((e) => e.shape === 'sofa')) {
      const inRoom = rooms.some((r) => meets(sofa, r));
      if (inRoom)
        expect(
          all.some((e) => e.shape === 'rug' && meets(sofa, e)),
          `${sofa.x}`,
        ).toBe(true);
    }
  });
});

// What each new Space is furnished with (docs/specs/012-collaboration/virtual-office-template.md "Spaces").
describe('the new Spaces furnish what they promise', () => {
  const count = (kind: TemplateKind, shape: string) =>
    shapes(buildTemplate(kind, 0, 0)).filter((e) => e.shape === shape).length;

  it('gives the Focus Library six desks, four shelves and two Office Pods', () => {
    expect(count('focus-library', 'desk')).toBe(6);
    expect(count('focus-library', 'bookshelf')).toBe(4);
    expect(count('focus-library', 'office-pod')).toBe(2);
  });

  it('gives the Training Room a stage, four tables and Bring Focus', () => {
    expect(count('training-room', 'stage')).toBe(1);
    expect(count('training-room', 'meeting-table')).toBe(4);
    expect(count('training-room', 'focus-button')).toBe(1);
  });

  it('gives the Rooftop Bar a two-counter bar, eight stools, a cabinet, a fridge and two lounges', () => {
    expect(count('rooftop-bar', 'bar')).toBe(2);
    expect(count('rooftop-bar', 'bar-stool')).toBe(8);
    expect(count('rooftop-bar', 'drinks-cabinet')).toBe(1);
    expect(count('rooftop-bar', 'drinks-fridge')).toBe(1);
    expect(count('rooftop-bar', 'sofa')).toBe(2);
  });

  it('seats the Rooftop Bar and the Cafe stools just in front of the bar, facing it', () => {
    for (const kind of ['rooftop-bar', 'cafe'] as const) {
      const all = shapes(buildTemplate(kind, 0, 0));
      const bars = all.filter((e) => e.shape === 'bar');
      for (const stool of all.filter((e) => e.shape === 'bar-stool')) {
        const bar = bars.find((b) => stool.x >= b.x && stool.x + stool.width <= b.x + b.width + 8);
        expect(bar, `${kind} stool at ${stool.x}`).toBeDefined();
        const gap = stool.y - (bar!.y + bar!.height);
        expect(gap, kind).toBeGreaterThanOrEqual(0);
        expect(gap, kind).toBeLessThanOrEqual(16);
      }
    }
  });

  it('gives the Cafe a counter with four stools, coffee and two tables', () => {
    expect(count('cafe', 'bar')).toBe(1);
    expect(count('cafe', 'bar-stool')).toBe(4);
    expect(count('cafe', 'coffee-machine')).toBe(1);
    expect(count('cafe', 'meeting-table')).toBe(2);
  });

  it('fences the Garden Retreat with a gate the path leads up from to the summer house door', () => {
    const els = buildTemplate('garden-retreat', 0, 0);
    const all = shapes(els);
    expect(count('garden-retreat', 'grass')).toBe(1);
    expect(count('garden-retreat', 'tree')).toBe(4);
    // The social pieces (docs/specs/009-elements/social-pieces.md).
    expect(count('garden-retreat', 'pond')).toBe(1);
    expect(count('garden-retreat', 'campfire')).toBe(1);
    expect(count('garden-retreat', 'bench')).toBe(1);
    const house = all.find((e) => e.shape === 'room')!;
    expect(house.label).toBe('Summer House');
    const span = roomDoorSpan(house.width, 's')!;
    const fences = all.filter((e) => e.shape === 'garden-fence');
    const bottom = Math.max(...fences.map((f) => f.y));
    const gateFences = fences.filter((f) => f.y === bottom).sort((a, b) => a.x - b.x);
    expect(gateFences).toHaveLength(2);
    const gate = { from: gateFences[0]!.x + gateFences[0]!.width, to: gateFences[1]!.x };
    // The path up from the gate is within it, and within the summer house's doorway.
    const path = all.find((e) => e.shape === 'garden-path' && e.height > e.width)!;
    expect(path.x).toBeGreaterThanOrEqual(gate.from);
    expect(path.x + path.width).toBeLessThanOrEqual(gate.to);
    expect(path.x).toBeGreaterThanOrEqual(house.x + span[0]);
    expect(path.x + path.width).toBeLessThanOrEqual(house.x + span[1]);
    expect(path.y).toBe(house.y + house.height);
    // The Walk In waits under the gate.
    const walk = all.find((e) => e.shape === 'mode-button')!;
    expect(walk.x + walk.width / 2).toBe(path.x + path.width / 2);
  });

  it('crosses the City Park with two paths meeting at a fountain plaza, a bandstand, benches and a picnic table', () => {
    // Four arms and the round plaza they meet at (docs/specs/009-elements/office.md "Garden Path": paths never cross).
    expect(count('city-park', 'garden-path')).toBe(5);
    expect(count('city-park', 'stage')).toBe(1);
    expect(count('city-park', 'bench')).toBe(2);
    expect(count('city-park', 'picnic-table')).toBe(1);
    expect(count('city-park', 'fountain')).toBe(1);
    expect(count('city-park', 'sofa')).toBe(0);
    expect(count('city-park', 'room')).toBe(0);
  });
});
