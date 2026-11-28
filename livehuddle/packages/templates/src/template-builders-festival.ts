// The Festival Field (docs/specs/012-collaboration/virtual-office-template.md "Venues", Work Tracker #648): the open-air
// venue, a fenced field built with campusPlan (template-campus-parts.ts) as the Beach Offsite is. Across the top, the
// open-air Main Stage with its curtains for a backdrop, and a big Screen either side; in front of it the
// open crowd field, where everyone arrives. Down the left, three food stalls (small tents: closed rooms with a counter)
// on a lane with picnic tables; down the right, the Bar Tent and, below it, the campfire area. A cross path joins the two
// lanes at a small round junction, and the path up from the gate meets it there.
//
// No new piece: a stall is a Room furnished from the bar and kitchen pieces, and the stage stands on the grass, heard by
// the whole tab (docs/specs/009-elements/office.md "Stage").
//
// Drawn at its final size for the 3D view (virtual-office-template.md "Laid out for the 3D view"): lanes and paths
// wide enough to walk two abreast, each stall's counter on its back wall, the benches turned to the fire.
//
// Pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import {
  campusPlan,
  fencedLawn,
  ONTO,
  plaza,
  REACH_SIDE,
  run,
  type CampusRoom,
} from './template-campus-parts';
import { against, outside, standAt, sofaOnRug } from './template-3d-place';

// A path two characters wide, side by side with room to pass.
const PATH = 112;
const W = 3000;
const H = 1800;
const MID = W / 2;
const GATE = 100;

// The two columns of tents, and the lanes REACH_SIDE out from their doors.
const COLUMN_W = 525;
const LEFT_X = 75;
const RIGHT_X = W - 75 - COLUMN_W;
const LEFT_LANE = LEFT_X + COLUMN_W + REACH_SIDE;
const RIGHT_LANE = RIGHT_X - REACH_SIDE - PATH;
// The cross path between the lanes, meeting the path up from the gate at a round junction.
const CROSS_Y = 1450;
const JUNCTION = 240;
const JOIN_IN = Math.sqrt((JUNCTION / 2) ** 2 - (PATH / 2) ** 2) - PATH / 2;
// How far each lane runs past the cross path's middle, so the cross path's ends lie under it.
const LANE_PAST = PATH / 2 + 48;

// The open-air Main Stage across the top, its curtains the backdrop behind it.
export const FESTIVAL_STAGE = { x: MID - 320, y: 140, w: 640, h: 170 };

// A food stall: a small tent, its counter on the back wall with stools in front, its door on the lane.
const STALL = { w: COLUMN_W, h: 375 };
const STALL_DOOR = { side: 'e', at: 210, sign: 1 } as const;
const STALL_YS = [75, 590, 1105];
const counter = (extra: OfficePiece): OfficePiece[] => [
  against('bar', 'n', 160, STALL),
  extra,
  ...[70, 130, 190, 250].map((x) => standAt('bar-stool', x, 126, 's')),
];

const TENT = { x: RIGHT_X, y: 75, w: COLUMN_W, h: 700 };
// The campfire area below the Bar Tent.
const FIRE = { x: RIGHT_X + COLUMN_W / 2, y: 1080 };

const rooms = (): CampusRoom[] => [
  {
    name: 'Pizza Stall',
    x: LEFT_X,
    y: STALL_YS[0]!,
    ...STALL,
    door: STALL_DOOR,
    pieces: counter(against('kitchen-counter', 'n', 400, STALL)),
  },
  {
    name: 'Taco Stall',
    x: LEFT_X,
    y: STALL_YS[1]!,
    ...STALL,
    door: STALL_DOOR,
    pieces: counter(against('drinks-fridge', 'n', 400, STALL)),
  },
  {
    name: 'Coffee Stall',
    x: LEFT_X,
    y: STALL_YS[2]!,
    ...STALL,
    door: STALL_DOOR,
    pieces: counter(against('coffee-machine', 'n', 400, STALL)),
  },
  {
    name: 'Bar Tent',
    ...TENT,
    door: { side: 'w', at: 380, sign: -1 },
    pieces: [
      // The bar on the back wall, its stools clear of the way in from the door.
      against('drinks-fridge', 'n', 80, TENT),
      against('bar', 'n', 300, TENT),
      ...[210, 270, 330, 390].map((x) => standAt('bar-stool', x, 126, 's')),
      against('jukebox', 'e', 330, TENT),
      // A sofa on the front wall over its rug, a chair beside the rug turned to it.
      ...sofaOnRug('s', 300, TENT),
      standAt('chair', 130, TENT.h - 180, 'w'),
      against('plant', 'e', TENT.h - 60, TENT),
    ],
  },
];

const field = (): OfficePiece[] => [
  ...fencedLawn(W, H, MID - GATE, MID + GATE),
  // The cross path in two halves, each ending on a lane and at the junction's rim, then the lanes over their ends, the
  // path up from the gate, and the junction over them all.
  run('garden-path', LEFT_LANE + ONTO, CROSS_Y - PATH / 2, MID - JOIN_IN - LEFT_LANE - ONTO, PATH),
  run(
    'garden-path',
    MID + JOIN_IN,
    CROSS_Y - PATH / 2,
    RIGHT_LANE + PATH - ONTO - MID - JOIN_IN,
    PATH,
  ),
  run('garden-path', LEFT_LANE, 260, PATH, CROSS_Y + LANE_PAST - 260),
  run('garden-path', RIGHT_LANE, 360, PATH, CROSS_Y + LANE_PAST - 360),
  run('garden-path', MID - PATH / 2, CROSS_Y + JOIN_IN, PATH, H - CROSS_Y - JOIN_IN),
  plaza(MID, CROSS_Y, JUNCTION),
  // The Main Stage: its curtains behind it, a big Screen either side. A Screen hangs on a wall (wall-mounted.ts), so
  // each hangs on the outside of the nearest tent, facing across the field: the Pizza Stall's and the Bar Tent's.
  { kind: 'stage', ...FESTIVAL_STAGE, stageCameras: true, label: 'Main Stage' },
  { kind: 'stage-curtains', x: FESTIVAL_STAGE.x, y: FESTIVAL_STAGE.y - 70, w: FESTIVAL_STAGE.w },
  outside('screen', { x: LEFT_X, y: STALL_YS[0]!, ...STALL }, 'e', 75),
  outside('screen', TENT, 'w', 140),
  // Picnic tables on the food lane's side of the crowd field, an umbrella beside each.
  standAt('picnic-table', 1000, 560),
  standAt('garden-umbrella', 1180, 560),
  standAt('picnic-table', 1000, 960),
  standAt('garden-umbrella', 1180, 960),
  // The campfire area below the Bar Tent: a bench on each side of the fire, facing it, trees and a hammock.
  standAt('campfire', FIRE.x, FIRE.y),
  standAt('bench', FIRE.x, FIRE.y - 150, 'n'),
  standAt('bench', FIRE.x - 170, FIRE.y, 'w'),
  standAt('bench', FIRE.x + 170, FIRE.y, 'e'),
  standAt('bench', FIRE.x, FIRE.y + 150, 's'),
  standAt('tree', RIGHT_X + 40, 900),
  standAt('tree', W - 110, 900),
  standAt('hammock', W - 180, 1500),
  // Under the trees in the bottom corners: a hammock on the left, a picnic table by the cross path.
  standAt('tree', 150, 1600),
  standAt('hammock', 320, 1620),
  standAt('tree', 500, 1600),
  standAt('picnic-table', 1000, 1640),
  standAt('tree', 2000, 1700),
  standAt('tree', 2400, 1700),
  // Planters either side of the gate, and the Directory just inside it.
  standAt('outdoor-plant', MID - 180, H - 90),
  standAt('outdoor-plant', MID + 180, H - 90),
  standAt('directory', MID + 140, H - 190),
];

export function buildFestivalField(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: H,
    rooms: rooms(),
    open: field(),
    // On the crowd field, in front of the Main Stage.
    arrival: { dx: 0, dy: 96 + 640 - (96 + H + 120) / 2 },
  });
}
