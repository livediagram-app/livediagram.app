// The Company Campus (docs/specs/012-collaboration/virtual-office-template.md "Campus Spaces"): a whole company on one
// site. Offices down the left (desks, a meeting room, a focus room), an auditorium with a Stage across the top, a bar
// and a games room down the right, and a garden between them: a walk along each column of doors, a cross path between
// them meeting the main path at a round fountain plaza, and the main path from the gate up through the plaza to the
// auditorium. Built with campusPlan (template-campus-parts.ts), which runs a path out from every door to its walk.
//
// Spacious by rule (the spec's "Room to walk"): seats side by side are one row or an aisle (two Regular characters,
// 120 px) apart, and the hall's centre aisle is 160 px, so walking past a chair never sits you in it.
//
// Pure: takes a centre (cx, cy) and returns a fresh Element[], floors first.

import { createShape, type Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import {
  campusPlan,
  fencedLawn,
  ONTO,
  PATH,
  plaza,
  plazaReach,
  REACH_SIDE,
  run,
  type CampusRoom,
} from './template-campus-parts';

const W = 2560;
const H = 1380;
const MID = W / 2;
const GATE = 72;

// The two columns of rooms, and the walks REACH_SIDE out from their doors.
const LEFT_X = 60;
const COLUMN_W = 500;
const RIGHT_X = 2000;
const LEFT_WALK = LEFT_X + COLUMN_W + REACH_SIDE;
const RIGHT_WALK = RIGHT_X - REACH_SIDE - PATH;
// The auditorium across the top between the walks, its door down the main path.
const HALL = { x: MID - 480, y: 60, w: 960, h: 600 };
// The fountain plaza on the main path, where the cross path meets it.
const CROSS_Y = 960;
const PLAZA_D = 300;
const PLAZA_IN = plazaReach(PLAZA_D);

// The hall's seats: two rows of four either side of a 160 px aisle up from the door, 120 px between the rows.
const LEFT_SEATS = [90, 168, 246, 324];
const RIGHT_SEATS = LEFT_SEATS.map((x) => x + 470);
const ROWS = [290, 494];

const ROOMS: CampusRoom[] = [
  {
    name: 'Desks',
    x: LEFT_X,
    y: 60,
    w: COLUMN_W,
    h: 640,
    door: { side: 'e', at: 320, sign: -1 },
    // Windows in its outside walls (docs/specs/009-elements/room-builder.md "Window").
    windows: [
      { side: 'w', at: 160 },
      { side: 'w', at: 480 },
    ],
    pieces: [
      // Two islands of four desks, 120 px apart, and the way in from the door clear to both.
      { kind: 'desk', x: 40, y: 56, facing: 'n' },
      { kind: 'desk', x: 176, y: 56, facing: 'n' },
      { kind: 'desk', x: 40, y: 168, facing: 's' },
      { kind: 'desk', x: 176, y: 168, facing: 's' },
      { kind: 'desk', x: 40, y: 400, facing: 'n' },
      { kind: 'desk', x: 176, y: 400, facing: 'n' },
      { kind: 'desk', x: 40, y: 512, facing: 's' },
      { kind: 'desk', x: 176, y: 512, facing: 's' },
      { kind: 'bookshelf', x: 360, y: 40 },
      { kind: 'water-cooler', x: 340, y: 470 },
      { kind: 'plant', x: 430, y: 500 },
    ],
  },
  {
    name: 'Meeting Room',
    x: LEFT_X,
    y: 760,
    w: COLUMN_W,
    h: 280,
    door: { side: 'e', at: 140, sign: -1 },
    windows: [{ side: 'w', at: 140 }],
    pieces: [
      { kind: 'screen', x: 184, y: 4, w: 106 },
      { kind: 'meeting-table', x: 120, y: 74 },
      { kind: 'plant', x: 20, y: 186 },
    ],
  },
  {
    name: 'Focus Room',
    x: LEFT_X,
    y: 1100,
    w: COLUMN_W,
    h: 220,
    door: { side: 'e', at: 110, sign: -1 },
    windows: [{ side: 'w', at: 110 }],
    pieces: [
      { kind: 'bookshelf', x: 40, y: 40 },
      { kind: 'desk', x: 200, y: 60, facing: 's' },
      { kind: 'plant', x: 340, y: 44 },
    ],
  },
  {
    name: 'Auditorium',
    ...HALL,
    // Its door's path runs straight down onto the fountain plaza.
    door: {
      side: 's',
      at: HALL.w / 2,
      sign: 1,
      reach: CROSS_Y - PLAZA_IN - HALL.y - HALL.h - PATH / 2,
    },
    windows: [
      { side: 'w', at: 300 },
      { side: 'w', at: 480 },
      { side: 'e', at: 300 },
      { side: 'e', at: 480 },
    ],
    pieces: [
      { kind: 'stage', x: 260, y: 48, w: 440, h: 150, stageCameras: true },
      { kind: 'screen', x: 40, y: 44, w: 176 },
      ...ROWS.flatMap((y) =>
        [...LEFT_SEATS, ...RIGHT_SEATS].map((x) => ({
          kind: 'chair' as const,
          x,
          y,
          facing: 's' as const,
        })),
      ),
      { kind: 'plant', x: 890, y: 60 },
    ],
  },
  {
    name: 'Bar',
    x: RIGHT_X,
    y: 60,
    w: COLUMN_W,
    h: 620,
    door: { side: 'w', at: 310, sign: -1 },
    windows: [
      { side: 'e', at: 160 },
      { side: 'e', at: 460 },
    ],
    pieces: [
      // The bar along the back with its stools, a clear band in front of them, and a lounge at the front.
      { kind: 'drinks-cabinet', x: 40, y: 40 },
      { kind: 'bar', x: 140, y: 40 },
      { kind: 'drinks-fridge', x: 400, y: 36 },
      ...[160, 220, 280, 340].map((x) => ({ kind: 'bar-stool' as const, x, y: 170 })),
      { kind: 'jukebox', x: 410, y: 300 },
      { kind: 'rug', x: 200, y: 420 },
      { kind: 'sofa', x: 224, y: 440, facing: 'n' },
      { kind: 'chair', x: 142, y: 448, facing: 'w' },
      { kind: 'plant', x: 30, y: 530 },
      { kind: 'plant', x: 430, y: 520 },
    ],
  },
  {
    name: 'Games Room',
    x: RIGHT_X,
    y: 740,
    w: COLUMN_W,
    h: 540,
    door: { side: 'w', at: 270, sign: -1 },
    windows: [
      { side: 'e', at: 140 },
      { side: 'e', at: 400 },
    ],
    pieces: [
      { kind: 'fireplace', x: 20, y: 40 },
      // The dog's bed by the fire (docs/specs/009-elements/workday-pieces.md "Pet Bed and its dog"), above the way in.
      { kind: 'pet-bed', x: 30, y: 166 },
      { kind: 'ping-pong-table', x: 190, y: 60 },
      { kind: 'arcade-machine', x: 410, y: 44 },
      { kind: 'arcade-machine', x: 410, y: 230 },
      { kind: 'rug', x: 160, y: 360 },
      { kind: 'sofa', x: 184, y: 380, facing: 'n' },
      { kind: 'chair', x: 342, y: 380, facing: 'e' },
      { kind: 'plant', x: 20, y: 440 },
    ],
  },
];

const GARDEN: OfficePiece[] = [
  ...fencedLawn(W, H, MID - GATE, MID + GATE),
  // The cross path in two halves, each ending on a walk and at the plaza's rim, then the walks over their ends, the
  // main path from the plaza to the gate, and the plaza over them all.
  run('garden-path', LEFT_WALK + ONTO, CROSS_Y - PATH / 2, MID - PLAZA_IN - LEFT_WALK - ONTO, PATH),
  run(
    'garden-path',
    MID + PLAZA_IN,
    CROSS_Y - PATH / 2,
    RIGHT_WALK + PATH - ONTO - MID - PLAZA_IN,
    PATH,
  ),
  run('garden-path', LEFT_WALK, 330, PATH, 932),
  run('garden-path', RIGHT_WALK, 330, PATH, 730),
  run('garden-path', MID - PATH / 2, CROSS_Y + PLAZA_IN, PATH, H - CROSS_Y - PLAZA_IN),
  plaza(MID, CROSS_Y, PLAZA_D),
  // The fountain in the middle of the plaza, a bench facing it from either side above the cross path.
  { kind: 'fountain', x: MID - 68, y: CROSS_Y - 60 },
  { kind: 'tree', x: 780, y: 690, w: 96 },
  { kind: 'bench', x: 980, y: 840 },
  { kind: 'bench', x: MID + PLAZA_D / 2 + 14, y: 840 },
  { kind: 'tree', x: 1640, y: 690, w: 96 },
  // Below it, left: a picnic table and a pond; right: a garden umbrella and a hammock.
  { kind: 'picnic-table', x: 790, y: 1040 },
  { kind: 'pond', x: 800, y: 1230, w: 200, h: 100 },
  { kind: 'tree', x: 1010, y: 1090, w: 80 },
  { kind: 'garden-umbrella', x: 1460, y: 1020 },
  { kind: 'hammock', x: 1620, y: 1040 },
  // By the gate: a car park of two (one row) to its right, a bike rack the other side of the main path
  // (docs/specs/009-elements/venue-pieces.md "In the templates").
  { kind: 'car-park', x: 1430, y: 1200 },
  { kind: 'car-park', x: 1670, y: 1200 },
  { kind: 'bike-rack', x: MID - PATH / 2 - 148, y: 1250 },
  // A tree in each top corner between the columns and the auditorium.
  { kind: 'tree', x: 600, y: 60, w: 96 },
  { kind: 'tree', x: 1850, y: 60, w: 96 },
  // The Directory just inside the gate: every room on the site, and a Walk There to each.
  { kind: 'directory', x: MID + 50, y: 1210 },
];

export function buildCompanyCampus(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: H,
    rooms: ROOMS,
    open: GARDEN,
    title: {
      text: 'Company Campus',
      width: 330,
      sticker: 'emoji-sunflower',
      subtitle:
        'The whole company on one site: offices, an auditorium, a bar and a games room, joined by a garden.',
    },
    // In the Auditorium, the company's meeting place, in the aisle between its first two rows, facing the stage.
    arrival: {
      dx: 0,
      dy: -246,
      hintW: 360,
      hint: 'You arrive on the Avatar Pad in the Auditorium. The Directory by the gate walks you to any room.',
    },
    // The presenter's Bring Focus, beside the stage.
    extra: (left, top) => [createShape('focus-button', left + HALL.x + 730, top + HALL.y + 64)],
  });
}
