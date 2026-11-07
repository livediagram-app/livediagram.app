// The Campus Spaces' shared parts (docs/specs/012-collaboration/virtual-office-template.md "Campus Spaces"): a whole
// site on one tab, rooms set in a fenced garden and joined by Garden Paths. Each room is closed (`roomDoor: 'none'`)
// and its way in is a Door piece standing on its wall (docs/specs/009-elements/room-builder.md "Door"). A short path
// runs out from every Door to a walk `reach` px from the wall, a Room Sign stands on the lawn beside it, and the paths
// join as docs/specs/009-elements/office.md "Garden Path" says: a path that meets another ends under it, and paths
// that cross meet at a round plaza. The Avatar Pad stands in the middle of it all (`arrival`: the courtyard, the lobby).
//
// Pure: campusPlan takes the site's top left and returns a fresh Element[], floors first.

import { createShape, snapDoorToWall, type Element, type ShapeElement } from '@livehuddle/document';
import { arrival, type Arrival } from './template-arrival';
import {
  SPACE_BELOW,
  SPACE_HEAD,
  spacePlan,
  type OfficePiece,
  type OfficeRoom,
} from './template-office-parts';

export type DoorSide = 'n' | 'e' | 's' | 'w';

/** A room on a campus: an office room with no doorway of its own, one Door on its walls and a sign by it. */
export type CampusRoom = Omit<OfficeRoom, 'door'> & {
  // The wall the Door stands on, how far along that wall its middle is (room-relative px), which way along the wall
  // its sign stands from the door's path (-1 towards the wall's start, 1 towards its end), and how far out from the
  // wall the walk its path joins starts (REACH_SIDE for a side wall, REACH_END for the top or bottom).
  door: { side: DoorSide; at: number; sign: -1 | 1; reach?: number };
};

// A Room's wall centre lines sit half a wall (5 px) inside its box, the back wall at its back face (36 px down):
// @liveworkspace/avatar/office-geometry's ROOM_WALL and ROOM_BACK_FACE.
const HALF_WALL = 5;
const BACK_FACE = 36;

// The Room Sign at a campus size: 88 wide (aspect locked, 136 x 72 drawn, so about 47 high). It stands SIDE_GAP off a
// side wall (its middle then 52 px out of the wall, 62 from the room's floor, inside the 64 px a sign reaches for its
// room: docs/specs/009-elements/screen-and-room-sign.md "A piece's room"), END_GAP below a bottom wall, or on the face
// of a back wall, SIGN_BESIDE along from the door's path, clear of the Door.
export const CAMPUS_SIGN_W = 88;
export const CAMPUS_SIGN_H = 47;
const SIDE_GAP = 8;
const END_GAP = 10;
const BACK_SIGN = 2;
const SIGN_BESIDE = 18;

export const PATH = 64;
// How far a walk keeps from a wall with doors on it: past the sign beside each door's path, with a little lawn between.
export const REACH_SIDE = SIDE_GAP + CAMPUS_SIGN_W + 14;
export const REACH_END = END_GAP + CAMPUS_SIGN_H + 15;
// How far a path's end runs onto the walk it joins, from the walk's near edge: its rounded end on the walk's gravel,
// its stones (kept back 0.7 of its width from its end) stopping short of the walk's edge.
export const TUCK = PATH / 2;
// A path ending on a walk running across it starts or stops this far in from the walk's edge (its cap on the walk,
// its first stone clear of it).
export const ONTO = 24;

/** A round plaza of diameter `d` centred on (cx, cy): a garden path about square draws round. */
export const plaza = (cx: number, cy: number, d: number): OfficePiece => ({
  kind: 'garden-path',
  x: cx - d / 2,
  y: cy - d / 2,
  w: d,
  h: d,
});

/** How far from a plaza's middle a path running into it ends: where its straight sides meet the rim. */
export const plazaReach = (d: number) => Math.sqrt((d / 2) ** 2 - (PATH / 2) ** 2) - PATH / 2;

// A junction where two paths would cross: the smallest plaza whose rim hides both paths' ends and none of their stones.
export const JUNCTION = 120;

// A garden fence or path of the given size: they are drawn to their own size, never aspect locked.
export const run = (
  kind: 'garden-fence' | 'garden-path',
  x: number,
  y: number,
  w: number,
  h: number,
): OfficePiece => ({ kind, x, y, w, h });

export const FENCE = 28;

/** The lawn, and a fence round it with a gate in the bottom run from `gateFrom` to `gateTo`. */
export function fencedLawn(
  width: number,
  height: number,
  gateFrom: number,
  gateTo: number,
): OfficePiece[] {
  return [
    { kind: 'grass', x: 0, y: 0, w: width, h: height },
    run('garden-fence', 0, 0, width, FENCE),
    run('garden-fence', 0, FENCE, FENCE, height - 2 * FENCE),
    run('garden-fence', width - FENCE, FENCE, FENCE, height - 2 * FENCE),
    run('garden-fence', 0, height - FENCE, gateFrom, FENCE),
    run('garden-fence', gateTo, height - FENCE, width - gateTo, FENCE),
  ];
}

/** Where a Door's middle stands on a room's wall: on the wall's centre line, `at` along it. */
function doorMiddle(room: ShapeElement, side: DoorSide, at: number): { x: number; y: number } {
  switch (side) {
    case 'n':
      return { x: room.x + at, y: room.y + BACK_FACE - HALF_WALL };
    case 's':
      return { x: room.x + at, y: room.y + room.height - HALF_WALL };
    case 'w':
      return { x: room.x + HALF_WALL, y: room.y + at };
    case 'e':
      return { x: room.x + room.width - HALF_WALL, y: room.y + at };
  }
}

/** A Door on the room's wall, snapped onto it as a placed Door is (turned to the wall, in the room's floor colour). */
export function doorOnWall(room: ShapeElement, side: DoorSide, at: number): ShapeElement {
  const middle = doorMiddle(room, side, at);
  const base = createShape('door', 0, 0);
  const free: ShapeElement = {
    ...base,
    x: middle.x - base.width / 2,
    y: middle.y - base.height / 2,
  };
  return snapDoorToWall(free, [room]);
}

export type CampusSite = {
  width: number;
  height: number;
  rooms: readonly CampusRoom[];
  // Under no roof: the lawn and its fence, the walks, plazas, trees and the garden's furniture (site-relative), paths in
  // the order they lie: a path that ends on another comes before it, plazas last.
  open: readonly OfficePiece[];
  title: { text: string; width: number; sticker: string; subtitle: string };
  // Where everyone arrives (template-arrival.ts): the Avatar Pad's centre, relative to the plan's centre, and its
  // how-to line. A building's upper floor has none here: it is arrived at by Elevator, and its pad stands by the
  // Elevators, one of its `open` pieces (docs/specs/012-collaboration/virtual-office-template.md "Spaces with floors").
  arrival?: Omit<Arrival, 'x' | 'y'> & { dx: number; dy: number };
  // Anything else placed absolutely (a stage's Bring Focus), given the site's top left.
  extra?: (left: number, top: number) => Element[];
};

const defaultReach = (side: DoorSide) => (side === 'e' || side === 'w' ? REACH_SIDE : REACH_END);

/** The path out from a room's Door to the walk `reach` from its wall, ending on the walk (site-relative). */
export function doorPath(r: CampusRoom): OfficePiece {
  const { side, at } = r.door;
  const long = (r.door.reach ?? defaultReach(side)) + TUCK;
  switch (side) {
    case 'e':
      return run('garden-path', r.x + r.w, r.y + at - PATH / 2, long, PATH);
    case 'w':
      return run('garden-path', r.x - long, r.y + at - PATH / 2, long, PATH);
    case 's':
      return run('garden-path', r.x + at - PATH / 2, r.y + r.h, PATH, long);
    case 'n':
      return run('garden-path', r.x + at - PATH / 2, r.y - long, PATH, long);
  }
}

/** The Room Sign beside a room's door path, on the lawn just off the wall (site-relative). */
export function doorSign(r: CampusRoom): OfficePiece {
  const { side, at, sign } = r.door;
  const along = (mid: number, size: number) =>
    sign < 0 ? mid - PATH / 2 - SIGN_BESIDE - size : mid + PATH / 2 + SIGN_BESIDE;
  const pos = (() => {
    switch (side) {
      case 'e':
        return { x: r.x + r.w + SIDE_GAP, y: along(r.y + at, CAMPUS_SIGN_H) };
      case 'w':
        return { x: r.x - SIDE_GAP - CAMPUS_SIGN_W, y: along(r.y + at, CAMPUS_SIGN_H) };
      case 's':
        return { x: along(r.x + at, CAMPUS_SIGN_W), y: r.y + r.h + END_GAP };
      // On the back wall's face beside the Door: the room's floor starts below that tall wall, too far for a sign
      // outside it to reach.
      case 'n':
        return { x: along(r.x + at, CAMPUS_SIGN_W), y: r.y + BACK_SIGN };
    }
  })();
  return { kind: 'room-sign', ...pos, w: CAMPUS_SIGN_W };
}

const GROUND = new Set(['grass', 'garden-fence']);

/** A room inside a building: its Door opens onto the floor's open corridor, so it runs no Garden Path. */
export type IndoorRoom = CampusRoom & { indoor: true };

/** A campus laid out round `(cx, cy)`: its heading, the site, every room's Door, path and sign, and the Avatar Pad. */
export function campusPlan(cx: number, cy: number, site: CampusSite): Element[] {
  const x0 = cx - site.width / 2;
  const y0 = cy - (SPACE_HEAD + site.height + SPACE_BELOW) / 2;
  const top = y0 + SPACE_HEAD;
  const rooms: OfficeRoom[] = site.rooms.map(({ door: _door, ...room }) => ({
    ...room,
    door: 'none',
  }));
  // The lawn, then every door's path (each ends under the walk it joins), then the rest in the site's order.
  const open: OfficePiece[] = [
    ...site.open.filter((p) => GROUND.has(p.kind)),
    ...site.rooms.filter((r) => !('indoor' in r)).map(doorPath),
    ...site.open.filter((p) => !GROUND.has(p.kind)),
    ...site.rooms.map(doorSign),
  ];
  const plan = spacePlan(
    x0,
    y0,
    site.width,
    rooms,
    site.title,
    [
      ...(site.extra?.(x0, top) ?? []),
      ...(site.arrival === undefined
        ? []
        : arrival({ ...site.arrival, x: cx + site.arrival.dx, y: cy + site.arrival.dy })),
    ],
    open,
  );
  // Each room's Door, on the wall the room names, after the floors so it paints over the wall it cuts.
  const doors = site.rooms.map((r) => {
    const room = plan.find(
      (el): el is ShapeElement => el.type === 'shape' && el.shape === 'room' && el.label === r.name,
    )!;
    return doorOnWall(room, r.door.side, r.door.at);
  });
  return [...plan, ...doors];
}
