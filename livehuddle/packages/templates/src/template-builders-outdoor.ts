// The Outdoor Spaces (docs/specs/012-collaboration/virtual-office-template.md "Spaces"): a Garden Retreat and a City
// Park, open-air floors of Grass and Garden Paths with Trees and Outdoor Plants, built with spacePlan's open pieces
// (template-office-parts.ts): the lawn and the paths lie under everything, a room (the Garden Retreat's summer house)
// over them. With no walls round them, a Garden Fence or the trees hold the edge, and the Avatar Pad waits under the
// gate or the path, so walking in is walking up it.
//
// Drawn at their final size for the 3D view (virtual-office-template.md "Laid out for the 3D view"): paths wide enough
// to walk two abreast, seats turned to the view, the fire or each other.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import { arrival } from './template-arrival';
import {
  SPACE_BELOW,
  SPACE_HEAD,
  spacePlan,
  type OfficePiece,
  type OfficeRoom,
} from './template-office-parts';
import { against, standAt } from './template-3d-place';

// A garden fence or path of the given size: they are drawn to their own size, never aspect locked.
const run = (
  kind: 'garden-fence' | 'garden-path',
  x: number,
  y: number,
  w: number,
  h: number,
): OfficePiece => ({ kind, x, y, w, h });

// A path two characters wide, side by side with room to pass.
const PATH = 112;
const FENCE = 28;
// A Door's width: a path up to one is no wider than its doorway.
const DOOR_PATH = 96;

// --- Garden Retreat ----------------------------------------------------------------

const GARDEN_W = 1600;
const GARDEN_H = 1000;
const MID = GARDEN_W / 2;
const GATE_FROM = MID - 100;
const GATE_TO = MID + 100;
const HOUSE = { x: MID - 200, y: 60, w: 400, h: 400 };
// The cross path's top, and where its two arms end: at the Bench, and at the Benches round the Campfire.
const CROSS_Y = 640;
const LEFT_END = 260;
const RIGHT_END = 1220;

export function buildGardenRetreat(cx: number, cy: number): Element[] {
  const width = GARDEN_W;
  const height = SPACE_HEAD + GARDEN_H + SPACE_BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const open: OfficePiece[] = [
    { kind: 'grass', x: 0, y: 0, w: GARDEN_W, h: GARDEN_H },
    // The path from the gate up to the Summer House's door, and its two arms across the lawn.
    // The path up is as wide as the doorway it leads to; the arms across the lawn are two abreast.
    run(
      'garden-path',
      MID - DOOR_PATH / 2,
      HOUSE.y + HOUSE.h,
      DOOR_PATH,
      GARDEN_H - HOUSE.y - HOUSE.h,
    ),
    run('garden-path', LEFT_END, CROSS_Y, MID - DOOR_PATH / 2 - LEFT_END, PATH),
    run('garden-path', MID + DOOR_PATH / 2, CROSS_Y, RIGHT_END - MID - DOOR_PATH / 2, PATH),
    run('garden-fence', 0, 0, GARDEN_W, FENCE),
    run('garden-fence', 0, FENCE, FENCE, GARDEN_H - 2 * FENCE),
    run('garden-fence', GARDEN_W - FENCE, FENCE, FENCE, GARDEN_H - 2 * FENCE),
    run('garden-fence', 0, GARDEN_H - FENCE, GATE_FROM, FENCE),
    run('garden-fence', GATE_TO, GARDEN_H - FENCE, GARDEN_W - GATE_TO, FENCE),
    // Trees round the lawn, a Hammock slung between the first two.
    standAt('tree', 110, 150),
    standAt('hammock', 250, 170),
    standAt('tree', 400, 200),
    standAt('tree', 1250, 150),
    standAt('tree', 1460, 320),
    standAt('outdoor-plant', HOUSE.x - 80, 300),
    standAt('outdoor-plant', HOUSE.x + HOUSE.w + 80, 300),
    // The pond under the trees, the Bench at the end of the left arm looking over it, the dog's bed beside it.
    { kind: 'pond', x: 60, y: 320, w: 280, h: 140 },
    standAt('bench', 200, 600, 's'),
    standAt('pet-bed', 360, 560),
    // Two Benches facing each other across the Campfire at the end of the right arm.
    standAt('bench', RIGHT_END + 60, CROSS_Y + PATH / 2, 'w'),
    standAt('campfire', RIGHT_END + 170, CROSS_Y + PATH / 2),
    standAt('bench', RIGHT_END + 280, CROSS_Y + PATH / 2, 'e'),
    standAt('outdoor-plant', GATE_FROM - 70, GARDEN_H - 90),
    standAt('outdoor-plant', GATE_TO + 70, GARDEN_H - 90),
  ];
  const house = { w: HOUSE.w, h: HOUSE.h };
  const rooms: OfficeRoom[] = [
    {
      name: 'Summer House',
      ...HOUSE,
      door: 's',
      windows: [
        { side: 'w', at: 200 },
        { side: 'e', at: 200 },
      ],
      pieces: [
        { kind: 'meeting-table', x: 84, y: 140 },
        against('plant', 's', 60, house),
        against('plant', 's', HOUSE.w - 60, house),
      ],
    },
  ];
  return spacePlan(
    x0,
    y0,
    rooms,
    // On the lawn beside the Summer House, off the paths.
    arrival({ x: x0 + HOUSE.x + HOUSE.w + 120, y: y0 + SPACE_HEAD + 550 }),
    open,
  );
}

// --- City Park ---------------------------------------------------------------------

const PARK_W = 1600;
const PARK_H = 1000;
const PARK_MID_X = PARK_W / 2;
const PARK_MID_Y = 480;
const PARK_PLAZA = 380;
// How far from the plaza's middle a path running into it ends: where its straight sides meet the rim.
const PLAZA_IN = Math.sqrt((PARK_PLAZA / 2) ** 2 - (PATH / 2) ** 2) - PATH / 2;

export function buildCityPark(cx: number, cy: number): Element[] {
  const width = PARK_W;
  const height = SPACE_HEAD + PARK_H + SPACE_BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const open: OfficePiece[] = [
    { kind: 'grass', x: 0, y: 0, w: PARK_W, h: PARK_H },
    // Two paths crossing the park, meeting at the round plaza.
    run('garden-path', 0, PARK_MID_Y - PATH / 2, PARK_MID_X - PLAZA_IN, PATH),
    run(
      'garden-path',
      PARK_MID_X + PLAZA_IN,
      PARK_MID_Y - PATH / 2,
      PARK_W - PARK_MID_X - PLAZA_IN,
      PATH,
    ),
    run('garden-path', PARK_MID_X - PATH / 2, 0, PATH, PARK_MID_Y - PLAZA_IN),
    run(
      'garden-path',
      PARK_MID_X - PATH / 2,
      PARK_MID_Y + PLAZA_IN,
      PATH,
      PARK_H - PARK_MID_Y - PLAZA_IN,
    ),
    run(
      'garden-path',
      PARK_MID_X - PARK_PLAZA / 2,
      PARK_MID_Y - PARK_PLAZA / 2,
      PARK_PLAZA,
      PARK_PLAZA,
    ),
    standAt('fountain', PARK_MID_X, PARK_MID_Y),
    // Two Benches on the plaza beside the fountain, facing each other across the path.
    standAt('bench', PARK_MID_X - 130, PARK_MID_Y - 120, 'n'),
    standAt('bench', PARK_MID_X - 130, PARK_MID_Y + 120, 's'),
    // The bandstand, two Benches side by side in front of it facing it.
    { kind: 'stage', x: 1080, y: 690, stageCameras: true },
    ...[1210, 1360].map((x) => standAt('bench', x, 925, 's')),
    standAt('tree', 90, 120),
    standAt('ping-pong-table', 380, 220),
    standAt('tree', PARK_W - 90, 120),
    // A Hammock under the corner trees.
    standAt('hammock', PARK_W - 260, 230),
    standAt('tree', PARK_W - 420, 150),
    standAt('picnic-table', 300, 790),
    standAt('tree', 470, 880),
    standAt('outdoor-plant', 60, 640),
    standAt('outdoor-plant', 60, 920),
  ];
  return spacePlan(
    x0,
    y0,
    [],
    // On the grass beside the path up into the park from the bottom.
    arrival({ x: cx - 170, y: y0 + SPACE_HEAD + PARK_H - 150 }),
    open,
  );
}
