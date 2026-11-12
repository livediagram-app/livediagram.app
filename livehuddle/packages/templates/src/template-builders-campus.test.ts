import { describe, expect, it } from 'vitest';
import {
  doorOnRoom,
  meetingPieceRoom,
  roomZones,
  seatsACharacter,
  type Element,
} from '@livehuddle/document';
import { AVATAR_WIDTH } from '@livehuddle/avatar/walk';
import { avatarScale } from '@livehuddle/avatar/config';
import { buildTemplate } from './build-template';
import { templateFloors } from './template-floors';
import { templateCategories, templateCategory } from './template-categories';
import { TEMPLATES, type TemplateKind } from './templates';

// docs/specs/012-collaboration/virtual-office-template.md "Campus Spaces", "Spaces with floors", "Games Rooms", "Homes"
// and "Venues": whole sites of rooms, in a fenced garden or a building's floors. Every room is closed and has one Door on
// its walls with a way out in front of it (a Garden Path outdoors, open floor indoors) and, but in a home, a Room Sign
// beside it, a Directory waits at the arrival point (above the Avatar Pad, or by a floor's Elevator), and every aisle is
// roomy.

type Shape = Extract<Element, { type: 'shape' }>;
type Box = { x: number; y: number; width: number; height: number };

// The whole sites: the Campus Spaces and the Venues built the same way.
const CAMPUS = TEMPLATES.map((t) => t.kind).filter((k) =>
  ['campus', 'venues'].includes(templateCategory(k) ?? ''),
);
// Every Space built as rooms with a Door each: the sites, the Games Rooms and the Homes.
const BUILT = TEMPLATES.map((t) => t.kind).filter((k) =>
  ['campus', 'venues', 'games', 'homes'].includes(templateCategory(k) ?? ''),
);
// Two Regular characters side by side; a seat catches a character only when its feet step onto it.
const AISLE = 2 * AVATAR_WIDTH * avatarScale('regular');
const ROW_GAP = 16;

const meets = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const shapes = (els: Element[]) => els.filter((e): e is Shape => e.type === 'shape');
// The strip `depth` px deep in front of a Door's footprint, on the side away from its room.
function outside(box: Box, room: Box, depth: number): Box {
  const vertical = box.height > box.width;
  if (vertical) {
    const west = box.x + box.width / 2 < room.x + room.width / 2;
    return {
      x: west ? box.x - depth : box.x + box.width,
      y: box.y,
      width: depth,
      height: box.height,
    };
  }
  const north = box.y + box.height / 2 < room.y + room.height / 2;
  return {
    x: box.x,
    y: north ? box.y - depth : box.y + box.height,
    width: box.width,
    height: depth,
  };
}
// A Door's real footprint: its box turned to a vertical wall when it stands on one.
const doorBox = (d: Shape): Box =>
  d.rotation === 90 || d.rotation === 270
    ? {
        x: d.x + d.width / 2 - d.height / 2,
        y: d.y + d.height / 2 - d.width / 2,
        width: d.height,
        height: d.width,
      }
    : d;

// What each site promises on its first tab: a Stage, a bar, a lawn.
const SITES: Record<string, { stage: boolean; lawn: boolean }> = {
  'company-campus': { stage: true, lawn: true },
  'conference-venue': { stage: true, lawn: true },
  'startup-hq': { stage: true, lawn: true },
  'school-quad': { stage: true, lawn: true },
  'hotel-and-suites': { stage: true, lawn: false },
  'coworking-tower': { stage: false, lawn: false },
  'music-hall': { stage: true, lawn: false },
  'festival-field': { stage: true, lawn: true },
};

it('files four Spaces under Campus and four under Venues, and cross-lists the Beach Offsite, the Expo Hall and the Festival Field', () => {
  expect(CAMPUS).toEqual(Object.keys(SITES));
  expect(TEMPLATES.filter((t) => templateCategory(t.kind) === 'campus').map((t) => t.kind)).toEqual(
    ['company-campus', 'startup-hq', 'school-quad', 'coworking-tower'],
  );
  expect(templateCategories('beach-offsite')).toEqual(['outdoor', 'campus']);
  expect(templateCategories('expo-hall')).toEqual(['events', 'venues']);
  expect(templateCategories('festival-field')).toEqual(['venues', 'outdoor']);
});

// Every tab of every site, Games Room and Home, and of the Beach Offsite: a site's floors are held to the same rules.
const TABS: [string, TemplateKind, Element[], boolean][] = [
  ...BUILT,
  'beach-offsite' as TemplateKind,
].flatMap((kind) => [
  [kind, kind, buildTemplate(kind, 0, 0), true] as [string, TemplateKind, Element[], boolean],
  ...templateFloors(kind).map(
    (f) =>
      [`${kind} ${f.name}`, kind, f.build(0, 0), false] as [
        string,
        TemplateKind,
        Element[],
        boolean,
      ],
  ),
]);

describe.each(CAMPUS)('the %s campus', (kind: TemplateKind) => {
  const all = shapes(buildTemplate(kind, 0, 0));
  const site = SITES[kind]!;

  it('has three or more named rooms, its Stage, a bar and its lawn', () => {
    const rooms = all.filter((e) => e.shape === 'room');
    expect(rooms.length).toBeGreaterThanOrEqual(3);
    expect(new Set(rooms.map((r) => r.label)).size).toBe(rooms.length);
    expect(all.filter((e) => e.shape === 'stage')).toHaveLength(site.stage ? 1 : 0);
    expect(all.some((e) => e.shape === 'bar')).toBe(true);
    expect(all.filter((e) => e.shape === 'grass')).toHaveLength(site.lawn ? 1 : 0);
  });

  // The Directory waits just inside the gate (or the front door), in the plan's bottom middle; the Avatar Pad is in
  // the middle of the action, never down there (docs/specs/009-elements/avatar-pad.md "Where a Space's pad stands").
  it('puts the Directory just inside the gate, and the Avatar Pad up in the site, away from it', () => {
    const [directory] = all.filter((e) => e.shape === 'directory');
    const walk = all.find((e) => e.shape === 'avatar-pad')!;
    expect(directory).toBeDefined();
    const bottom = Math.max(...all.filter((e) => e !== walk).map((e) => e.y + e.height));
    // Built round (0, 0): the plan's middle is x 0.
    expect(Math.abs(directory!.x + directory!.width / 2)).toBeLessThan(200);
    expect(bottom - (directory!.y + directory!.height)).toBeLessThan(200);
    expect(directory!.y).toBeGreaterThan(walk.y);
  });
});

describe.each(TABS)('the %s site', (_name, kind, els, first) => {
  const all = shapes(els);
  // A home's rooms carry no Room Sign (docs/specs/012-collaboration/virtual-office-template.md "Homes").
  const home = templateCategory(kind) === 'homes';
  const rooms = all.filter((e) => e.shape === 'room');
  const doors = all.filter((e) => e.shape === 'door');
  const paths = all.filter((e) => e.shape === 'garden-path');
  // Outdoors (a garden or a beach), every door is on a Garden Path; indoors it opens onto the floor.
  const lawn = paths.length > 0;

  it('closes every room and gives it exactly one Door on its walls, a path outside it', () => {
    for (const room of rooms) {
      expect(room.roomDoor, room.label).toBe('none');
      const own = doors.filter((d) => doorOnRoom(d, room));
      expect(own, room.label).toHaveLength(1);
      const box = doorBox(own[0]!);
      if (lawn) {
        // Outdoors, the door's footprint, grown 40 px out of the room, reaches a garden path.
        const grown = {
          x: box.x - 40,
          y: box.y - 40,
          width: box.width + 80,
          height: box.height + 80,
        };
        expect(
          paths.some((p) => meets(p, grown)),
          room.label,
        ).toBe(true);
        continue;
      }
      // Indoors, 160 px of open floor in front of it: no room and no piece of furniture.
      const out = outside(box, room, 160);
      for (const piece of all) {
        if (['door', 'room-sign', 'rug'].includes(piece.shape) || piece === room) continue;
        expect(meets(piece, out), `${room.label}: ${piece.shape} at ${piece.x},${piece.y}`).toBe(
          false,
        );
      }
    }
    expect(doors).toHaveLength(rooms.length);
  });

  it('keeps the first 96 px inside every Door clear of seats and scenery', () => {
    for (const room of rooms) {
      const box = doorBox(doors.find((d) => doorOnRoom(d, room))!);
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      const vertical = box.height > box.width;
      const inward = vertical
        ? cx < room.x + room.width / 2
          ? 1
          : -1
        : cy < room.y + room.height / 2
          ? 1
          : -1;
      const approach: Box = vertical
        ? { x: inward > 0 ? cx : cx - 96, y: cy - 48, width: 96, height: 96 }
        : { x: cx - 48, y: inward > 0 ? cy : cy - 96, width: 96, height: 96 };
      for (const piece of all) {
        if (
          ['room', 'door', 'rug', 'garden-path', 'grass', 'room-sign', 'screen'].includes(
            piece.shape,
          )
        )
          continue;
        expect(
          meets(piece, approach),
          `${room.label}: ${piece.shape} at ${piece.x},${piece.y}`,
        ).toBe(false);
      }
    }
  });

  it('signs every room by its door, the sign reading that room', () => {
    const zones = roomZones(els);
    const signs = all.filter((e) => e.shape === 'room-sign');
    if (home) {
      expect(signs).toEqual([]);
      return;
    }
    expect(signs).toHaveLength(rooms.length);
    const read = signs.map((s) => meetingPieceRoom(s, zones));
    expect(new Set(read).size).toBe(rooms.length);
    for (const room of rooms) expect(read, room.label).toContain(room.id);
  });

  it('names every Elevator, and stands a Directory and an Avatar Pad beside one on a floor arrived at by lift', () => {
    const lifts = all.filter((e) => e.shape === 'elevator');
    for (const lift of lifts) expect(lift.label?.trim(), `${lift.x}`).toBeTruthy();
    if (first) return;
    // A home's upper floor is arrived at by its Stairs: its pad stands on the landing beside them, and it has no lift.
    if (home) {
      const pad = all.find((e) => e.shape === 'avatar-pad')!;
      const stairs = all.filter((e) => e.shape === 'stairs');
      expect(lifts).toEqual([]);
      expect(stairs.some((s) => Math.hypot(s.x - pad.x, s.y - pad.y) < 300)).toBe(true);
      return;
    }
    expect(lifts.length).toBeGreaterThan(0);
    const directory = all.find((e) => e.shape === 'directory')!;
    expect(directory).toBeDefined();
    const near = lifts.some((l) => Math.hypot(l.x - directory.x, l.y - directory.y) < 300);
    expect(near).toBe(true);
    // Changing floor from the tab bar arrives on the pad, by the lifts (docs/specs/009-elements/avatar-pad.md "Every
    // Space and blank tab has one").
    const pad = all.find((e) => e.shape === 'avatar-pad')!;
    expect(pad).toBeDefined();
    expect(lifts.some((l) => Math.hypot(l.x - pad.x, l.y - pad.y) < 300)).toBe(true);
  });

  // docs/specs/007-editor/templates-by-mode.md "Every Space is roomy": seats side by side are one row or an aisle
  // apart, and one behind another share an edge or are an aisle apart.
  it('keeps every aisle between seats wide enough to walk', () => {
    // A Podium is held like a seat but stands on a stage, not in a row (venue-pieces.md "Speaking from the Podium").
    const seats = all.filter((e) => seatsACharacter(e.shape) && e.shape !== 'podium');
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
        if (seats.some((c) => c !== a && c !== b && meets(c, gap))) continue;
        if (gy < 0 && gx >= 0) expect(gx <= ROW_GAP || gx >= AISLE, `${at}: ${gx}`).toBe(true);
        if (gx < 0 && gy >= 0) expect(gy === 0 || gy >= AISLE, `${at}: ${gy}`).toBe(true);
      }
  });

  it('seats its auditorium either side of an aisle at least 160 px wide up from the door', () => {
    const stage = all.find((e) => e.shape === 'stage');
    const hall = stage && rooms.find((r) => meets(r, stage));
    if (!hall) return;
    const door = doorBox(doors.find((d) => doorOnRoom(d, hall))!);
    const mid = door.x + door.width / 2;
    const chairs = all.filter((e) => e.shape === 'chair' && meets(e, hall));
    expect(chairs.length).toBeGreaterThanOrEqual(12);
    const left = Math.max(...chairs.filter((c) => c.x < mid).map((c) => c.x + c.width));
    const right = Math.min(...chairs.filter((c) => c.x > mid).map((c) => c.x));
    expect(right - left).toBeGreaterThanOrEqual(160);
  });
});
