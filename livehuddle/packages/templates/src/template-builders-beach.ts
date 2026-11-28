// The Beach Offsite (docs/specs/012-collaboration/virtual-office-template.md "More Spaces"): a team's day away on the
// sand (the tab's Sand floor). Along the top, a lagoon (a Pond), a Tiki Bar and a Beach Hut to meet in, each closed
// with a Door; a stone path along the beach in front of them meets the path up from the Avatar Pad at a small round
// junction; below it, hammocks under the palms, a campfire circle of benches, garden umbrellas and a swimming pool. No fence: a beach
// is open, and the Avatar Pad waits where the path comes up off the road. Built with campusPlan
// (template-campus-parts.ts), drawn at its final size for the 3D view (virtual-office-template.md "Laid out for the 3D
// view"): its paths wide enough to walk two abreast, each Door's path widened over the one campusPlan runs.
//
// Pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import { campusPlan, run, type CampusRoom } from './template-campus-parts';
import { against, besideX, standAt } from './template-3d-place';

// A path two characters wide, side by side with room to pass.
const PATH = 112;
const W = 2500;
const H = 1500;
// The gate's path up from the road, and the walk along the beach in front of the huts.
const GATE = 750;
const WALK_Y = 700;
const ROOM_Y = 75;
const ROOM_H = 525;
// The round junction where the gate's path meets the walk, and how far from its middle a path ends in it.
const JUNCTION = 240;
const JOIN_Y = WALK_Y + PATH / 2;
const JOIN_IN = Math.sqrt((JUNCTION / 2) ** 2 - (PATH / 2) ** 2) - PATH / 2;
// How far below a hut the walk runs, for its Door's path.
const DOWN = WALK_Y - ROOM_Y - ROOM_H;

const TIKI = { x: 950, y: ROOM_Y, w: 650, h: ROOM_H };
const HUT = { x: besideX(TIKI), y: ROOM_Y, w: 700, h: ROOM_H };

const rooms = (): CampusRoom[] => [
  {
    name: 'Tiki Bar',
    ...TIKI,
    door: { side: 's', at: 325, sign: 1, reach: DOWN },
    windows: [
      { side: 'n', at: 470 },
      { side: 'w', at: 260 },
    ],
    pieces: [
      against('bar', 'n', 180, TIKI),
      against('drinks-fridge', 'n', 360, TIKI),
      ...[90, 150, 210, 270].map((x) => standAt('bar-stool', x, 126, 's')),
      against('jukebox', 'n', 590, TIKI),
      against('plant', 's', 590, TIKI),
    ],
  },
  {
    name: 'Beach Hut',
    ...HUT,
    door: { side: 's', at: 350, sign: 1, reach: DOWN },
    windows: [
      { side: 'n', at: 560 },
      { side: 'e', at: 260 },
    ],
    pieces: [
      against('screen', 'n', 350, HUT),
      { kind: 'meeting-table', x: 234, y: 190 },
      against('plant', 's', 640, HUT),
    ],
  },
];

// A Door's path down to the walk, as wide as the walk.
const doorWalk = (box: typeof TIKI, at: number): OfficePiece =>
  run('garden-path', box.x + at - PATH / 2, box.y + box.h - 10, PATH, WALK_Y - box.y - box.h + 30);

const beach = (): OfficePiece[] => [
  // The walk along the beach either side of the junction, the gate's path up to it, each Door's path, then the
  // junction over them.
  run('garden-path', 150, WALK_Y, GATE - JOIN_IN - 150, PATH),
  run('garden-path', GATE + JOIN_IN, WALK_Y, W - 150 - GATE - JOIN_IN, PATH),
  run('garden-path', GATE - PATH / 2, JOIN_Y + JOIN_IN, PATH, H - JOIN_Y - JOIN_IN),
  doorWalk(TIKI, 325),
  doorWalk(HUT, 350),
  {
    kind: 'garden-path',
    x: GATE - JUNCTION / 2,
    y: JOIN_Y - JUNCTION / 2,
    w: JUNCTION,
    h: JUNCTION,
  },
  // The lagoon, a Ping-Pong Table on the sand in front of it, palms along it.
  { kind: 'pond', x: 100, y: 100, w: 700, h: 380 },
  standAt('ping-pong-table', 470, 580),
  standAt('tree', 870, 300),
  // Hammocks under the palms.
  standAt('tree', 100, 1010),
  standAt('hammock', 280, 1040),
  standAt('tree', 460, 1010),
  standAt('hammock', 230, 1300),
  standAt('tree', 400, 1280),
  // The campfire circle: three benches round the fire, facing it.
  standAt('bench', 1250, 980, 'n'),
  standAt('bench', 1090, 1110, 'w'),
  standAt('campfire', 1250, 1110),
  standAt('bench', 1410, 1110, 'e'),
  // Garden umbrellas over the sand, and the pool.
  standAt('garden-umbrella', 1800, 960),
  standAt('garden-umbrella', 2100, 960),
  { kind: 'swimming-pool', x: 1700, y: 1130, w: 520, h: 260 },
  standAt('outdoor-plant', 1600, 1400),
  standAt('outdoor-plant', 2360, 1250),
  standAt('directory', GATE + 130, 1400),
];

export function buildBeachOffsite(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: H,
    rooms: rooms(),
    open: beach(),
    // Beside the gate's path where it comes up off the road, below the junction.
    arrival: { dx: GATE + 140 - W / 2, dy: 96 + 1020 - (96 + H + 120) / 2 },
  });
}
