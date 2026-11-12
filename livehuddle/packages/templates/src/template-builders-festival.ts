// The Festival Field (docs/specs/012-collaboration/virtual-office-template.md "Venues", Work Tracker #648): the open-air
// venue, a fenced field built with campusPlan (template-campus-parts.ts) as the Beach Offsite is. Across the top, the
// open-air Main Stage with its curtains for a backdrop, a big Screen either side and Bring Focus; in front of it the
// open crowd field, where everyone arrives. Down the left, three food stalls (small tents: closed rooms with a counter)
// on a lane with picnic tables; down the right, the Bar Tent and, below it, the campfire area. A cross path joins the two
// lanes at a small round junction, and the path up from the gate meets it there.
//
// No new piece: a stall is a Room furnished from the bar and kitchen pieces, and the stage stands on the grass, heard by
// the whole tab (docs/specs/009-elements/office.md "Stage").
//
// Pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import { createShape, type Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import {
  campusPlan,
  fencedLawn,
  JUNCTION,
  ONTO,
  PATH,
  plaza,
  plazaReach,
  REACH_SIDE,
  run,
  type CampusRoom,
} from './template-campus-parts';

const W = 2560;
const H = 1440;
const MID = W / 2;
const GATE = 72;

// The two columns of tents, and the lanes REACH_SIDE out from their doors.
const COLUMN_W = 440;
const LEFT_X = 60;
const RIGHT_X = W - 60 - COLUMN_W;
const LEFT_LANE = LEFT_X + COLUMN_W + REACH_SIDE;
const RIGHT_LANE = RIGHT_X - REACH_SIDE - PATH;
// The cross path between the lanes, meeting the path up from the gate at a small round junction.
const CROSS_Y = 1160;
const JOIN_IN = plazaReach(JUNCTION);
// How far each lane runs past the cross path's middle, so the cross path's ends lie under it.
const LANE_PAST = PATH / 2 + 48;

// The open-air Main Stage across the top, its curtains the backdrop behind it.
export const FESTIVAL_STAGE = { x: MID - 320, y: 110, w: 640, h: 170 };

// A food stall: a small tent, its counter along the back with stools in front, its door on the lane.
const STALL_H = 280;
const STALL_DOOR = { side: 'e', at: 210, sign: -1 } as const;
const counter = (extra: OfficePiece): OfficePiece[] => [
  { kind: 'bar', x: 40, y: 40 },
  extra,
  ...[60, 120, 180, 240].map((x) => ({ kind: 'bar-stool' as const, x, y: 170 })),
];

const ROOMS: CampusRoom[] = [
  {
    name: 'Pizza Stall',
    x: LEFT_X,
    y: 60,
    w: COLUMN_W,
    h: STALL_H,
    door: STALL_DOOR,
    pieces: counter({ kind: 'kitchen-counter', x: 300, y: 40 }),
  },
  {
    name: 'Taco Stall',
    x: LEFT_X,
    y: 400,
    w: COLUMN_W,
    h: STALL_H,
    door: STALL_DOOR,
    pieces: counter({ kind: 'drinks-fridge', x: 320, y: 30 }),
  },
  {
    name: 'Coffee Stall',
    x: LEFT_X,
    y: 740,
    w: COLUMN_W,
    h: STALL_H,
    door: STALL_DOOR,
    pieces: counter({ kind: 'coffee-machine', x: 320, y: 40 }),
  },
  {
    name: 'Bar Tent',
    x: RIGHT_X,
    y: 60,
    w: COLUMN_W,
    h: 560,
    door: { side: 'w', at: 300, sign: -1 },
    pieces: [
      // The bar along the back, its stools clear of the way in from the door.
      { kind: 'drinks-fridge', x: 40, y: 36 },
      { kind: 'bar', x: 140, y: 40 },
      ...[160, 220, 280, 340].map((x) => ({ kind: 'bar-stool' as const, x, y: 170 })),
      { kind: 'jukebox', x: 350, y: 260 },
      { kind: 'rug', x: 160, y: 400 },
      { kind: 'sofa', x: 184, y: 420, facing: 'n' },
      { kind: 'chair', x: 102, y: 428, facing: 'e' },
      { kind: 'plant', x: 372, y: 440 },
    ],
  },
];

const FIELD: OfficePiece[] = [
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
  run('garden-path', LEFT_LANE, 210, PATH, CROSS_Y + LANE_PAST - 210),
  run('garden-path', RIGHT_LANE, 310, PATH, CROSS_Y + LANE_PAST - 310),
  run('garden-path', MID - PATH / 2, CROSS_Y + JOIN_IN, PATH, H - CROSS_Y - JOIN_IN),
  plaza(MID, CROSS_Y, JUNCTION),
  // The Main Stage: its curtains behind it, a big Screen either side.
  { kind: 'stage', ...FESTIVAL_STAGE, stageCameras: true, label: 'Main Stage' },
  { kind: 'stage-curtains', x: FESTIVAL_STAGE.x, y: FESTIVAL_STAGE.y - 70, w: FESTIVAL_STAGE.w },
  { kind: 'screen', x: FESTIVAL_STAGE.x - 220, y: 120, w: 176 },
  { kind: 'screen', x: FESTIVAL_STAGE.x + FESTIVAL_STAGE.w + 44, y: 120, w: 176 },
  // Picnic tables on the food lane's side of the crowd field, an umbrella beside each.
  { kind: 'picnic-table', x: 720, y: 420 },
  { kind: 'garden-umbrella', x: 936, y: 420 },
  { kind: 'picnic-table', x: 720, y: 740 },
  { kind: 'garden-umbrella', x: 936, y: 740 },
  // The campfire area below the Bar Tent: a bench on each side of the fire, trees and a hammock.
  { kind: 'campfire', x: 2190, y: 880 },
  { kind: 'bench', x: 1996, y: 884 },
  { kind: 'bench', x: 2328, y: 884 },
  { kind: 'bench', x: 2162, y: 754 },
  { kind: 'bench', x: 2162, y: 1006 },
  { kind: 'tree', x: 1990, y: 690, w: 80 },
  { kind: 'tree', x: 2400, y: 690, w: 96 },
  { kind: 'hammock', x: 2320, y: 1080 },
  // Under the trees in the bottom corners: a hammock on the left, a picnic table by the cross path.
  { kind: 'tree', x: 120, y: 1250, w: 96 },
  { kind: 'hammock', x: 240, y: 1290 },
  { kind: 'tree', x: 420, y: 1250, w: 96 },
  { kind: 'picnic-table', x: 760, y: 1240 },
  { kind: 'tree', x: 1700, y: 1240, w: 96 },
  { kind: 'tree', x: 2100, y: 1240, w: 96 },
  // Planters either side of the gate, and the Directory just inside it.
  { kind: 'outdoor-plant', x: MID - 140, y: 1320 },
  { kind: 'outdoor-plant', x: MID + 140, y: 1320 },
  { kind: 'directory', x: MID + 50, y: 1260 },
];

export function buildFestivalField(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: H,
    rooms: ROOMS,
    open: FIELD,
    title: {
      text: 'Festival Field',
      width: 300,
      sticker: 'emoji-fireworks',
      subtitle:
        'A day out in the open: the band on the main stage, food from the stalls, then the bar tent and the campfire.',
    },
    // On the crowd field, in front of the Main Stage.
    arrival: {
      dx: 0,
      dy: 560 - H / 2 + 12,
      hint: 'You arrive on the Avatar Pad in front of the Main Stage. Whoever is on the stage is heard by everyone.',
    },
    // The stage's Bring Focus, below the right-hand Screen.
    extra: (left, top) => [createShape('focus-button', left + 1690, top + 250)],
  });
}
