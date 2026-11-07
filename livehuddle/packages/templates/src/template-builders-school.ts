// The School Quad (docs/specs/012-collaboration/virtual-office-template.md "Campus Spaces"): a lecture hall across the
// top, two classrooms down the left, a library and a canteen down the right, round a grassy quad. A walk runs down
// each side past the classroom and library doors, a walk across the top meets the lecture hall's door, and a walk
// across the bottom meets the main path from the gate at a round fountain plaza. Built with campusPlan
// (template-campus-parts.ts), spacious by the same rule as the other campuses.
//
// Pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import { createShape, type Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import {
  campusPlan,
  fencedLawn,
  ONTO,
  PATH,
  plaza,
  plazaReach,
  REACH_END,
  REACH_SIDE,
  run,
  type CampusRoom,
} from './template-campus-parts';

const W = 2300;
const H = 1460;
const MID = W / 2;
const GATE = 72;
const SIDE_W = 460;
const SIDE_H = 540;
const LEFT_X = 60;
const RIGHT_X = W - 60 - SIDE_W;
// The walks down each side, REACH_SIDE out from the side rooms' walls.
const LEFT_WALK = LEFT_X + SIDE_W + REACH_SIDE;
const RIGHT_WALK = RIGHT_X - REACH_SIDE - PATH;
// The lecture hall, and the walk across the top just below its door.
const HALL = { x: MID - 380, y: 60, w: 760, h: 600 };
const TOP_WALK = HALL.y + HALL.h + REACH_END;
// The walk across the bottom, and the fountain plaza where the main path from the gate meets it.
const BOTTOM_WALK = 1100;
const PLAZA_D = 300;
const PLAZA_Y = BOTTOM_WALK + PATH / 2;
const PLAZA_IN = plazaReach(PLAZA_D);
// A side room's door, between its two rows of desks.
const SIDE_DOOR = 352;

// A row of chairs facing the stage up the hall.
const seats = (xs: readonly number[], ys: readonly number[]): OfficePiece[] =>
  ys.flatMap((y) => xs.map((x) => ({ kind: 'chair' as const, x, y, facing: 's' as const })));

// Desks in a row facing the front of the room (their backs to the door side of the room).
const deskRow = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => ({ kind: 'desk' as const, x, y, facing: 's' as const }));

// A classroom: a Screen on the back wall and two rows of three desks facing it, an aisle between the rows where the
// door comes in.
function classroom(name: string, y: number): CampusRoom {
  return {
    name,
    x: LEFT_X,
    y,
    w: SIDE_W,
    h: SIDE_H,
    door: { side: 'e', at: SIDE_DOOR, sign: -1 },
    // Windows in its outside walls (docs/specs/009-elements/room-builder.md "Window").
    windows: [
      { side: 'w', at: 150 },
      { side: 'w', at: 400 },
    ],
    pieces: [
      { kind: 'screen', x: 170, y: 44, w: 176 },
      ...deskRow([16, 136, 256], 180),
      ...deskRow([16, 136, 256], 412),
    ],
  };
}

const ROOMS: CampusRoom[] = [
  classroom('Classroom A', 60),
  classroom('Classroom B', 660),
  {
    name: 'Lecture Hall',
    ...HALL,
    door: { side: 's', at: 380, sign: 1 },
    windows: [
      { side: 'w', at: 300 },
      { side: 'e', at: 300 },
    ],
    pieces: [
      { kind: 'stage', x: 200, y: 48, stageCameras: true },
      { kind: 'screen', x: 40, y: 44, w: 140 },
      // Two rows of three either side of a 160 px aisle up from the door, 120 px between the rows.
      ...seats([68, 146, 224], [280, 484]),
      ...seats([460, 538, 616], [280, 484]),
    ],
  },
  {
    name: 'Library',
    x: RIGHT_X,
    y: 60,
    w: SIDE_W,
    h: SIDE_H,
    door: { side: 'w', at: SIDE_DOOR, sign: -1 },
    windows: [
      { side: 'e', at: 150 },
      { side: 'e', at: 400 },
    ],
    pieces: [
      // Shelves along the back wall, a row of study desks in front of them, clear of the door's way in.
      ...[40, 170, 300].map((x) => ({ kind: 'bookshelf' as const, x, y: 40 })),
      ...deskRow([150, 280], 292),
      // A reading corner below the way in: two Bean Bags side by side.
      { kind: 'bean-bag', x: 20, y: 452 },
      { kind: 'bean-bag', x: 84, y: 452 },
      { kind: 'plant', x: 380, y: 440 },
    ],
  },
  {
    name: 'Canteen',
    x: RIGHT_X,
    y: 660,
    w: SIDE_W,
    h: SIDE_H,
    door: { side: 'w', at: SIDE_DOOR, sign: -1 },
    windows: [
      { side: 'e', at: 150 },
      { side: 'e', at: 440 },
    ],
    pieces: [
      // The counter with its stools, coffee beside it, and a table an aisle in front of the stools.
      // Along the back wall away from the door's side, so no stool stands in its way in.
      { kind: 'drinks-fridge', x: 40, y: 36 },
      { kind: 'bar', x: 180, y: 40 },
      ...[200, 260, 320, 380].map((x) => ({ kind: 'bar-stool' as const, x, y: 170 })),
      { kind: 'coffee-machine', x: 30, y: 190 },
      { kind: 'meeting-table', x: 150, y: 354 },
    ],
  },
];

const GROUNDS: OfficePiece[] = [
  ...fencedLawn(W, H, MID - GATE, MID + GATE),
  // The walks across the top and the bottom first (each ends under the side walks; the bottom one in two halves,
  // ending at the plaza's rim), then the side walks, the main path from the plaza to the gate, and the plaza.
  run('garden-path', LEFT_WALK + ONTO, TOP_WALK, RIGHT_WALK + PATH - ONTO - LEFT_WALK - ONTO, PATH),
  run('garden-path', LEFT_WALK + ONTO, BOTTOM_WALK, MID - PLAZA_IN - LEFT_WALK - ONTO, PATH),
  run('garden-path', MID + PLAZA_IN, BOTTOM_WALK, RIGHT_WALK + PATH - ONTO - MID - PLAZA_IN, PATH),
  run('garden-path', LEFT_WALK, 300, PATH, BOTTOM_WALK + PATH - 300),
  run('garden-path', RIGHT_WALK, 300, PATH, BOTTOM_WALK + PATH - 300),
  run('garden-path', MID - PATH / 2, PLAZA_Y + PLAZA_IN, PATH, H - PLAZA_Y - PLAZA_IN),
  plaza(MID, PLAZA_Y, PLAZA_D),
  { kind: 'fountain', x: MID - 68, y: PLAZA_Y - 60 },
  // The quad: trees in its corners, a picnic table in the middle and benches either side of the plaza.
  { kind: 'tree', x: 760, y: 820 },
  { kind: 'tree', x: 1420, y: 820 },
  { kind: 'picnic-table', x: MID - 100, y: 810 },
  { kind: 'bench', x: 850, y: 1010 },
  { kind: 'bench', x: 1314, y: 1010 },
  // Outside the walks: trees, a pond, a garden umbrella and a hammock.
  { kind: 'tree', x: 540, y: 70, w: 64 },
  { kind: 'tree', x: 1696, y: 70, w: 64 },
  { kind: 'tree', x: 90, y: 1236 },
  { kind: 'pond', x: 260, y: 1260, w: 200, h: 100 },
  { kind: 'garden-umbrella', x: 1760, y: 1236 },
  { kind: 'hammock', x: 1980, y: 1320 },
  // The Directory just inside the gate.
  { kind: 'directory', x: MID + 50, y: 1300 },
];

export function buildSchoolQuad(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: H,
    rooms: ROOMS,
    open: GROUNDS,
    title: {
      text: 'School Quad',
      width: 280,
      sticker: 'emoji-books',
      subtitle:
        'Learn together: the lecture in the hall, groups in the classrooms, quiet in the library and lunch in the canteen.',
    },
    // In the Lecture Hall, in the aisle between its first two rows, facing the stage.
    arrival: {
      dx: 0,
      dy: -318,
      hintW: 360,
      hint: 'You arrive on the Avatar Pad in the Lecture Hall. The Directory by the gate walks you to any room.',
    },
    extra: (left, top) => [createShape('focus-button', left + HALL.x + 580, top + HALL.y + 60)],
  });
}
