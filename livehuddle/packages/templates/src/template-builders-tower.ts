// The Co-working Tower (docs/specs/012-collaboration/virtual-office-template.md "Spaces with floors"): a co-working
// building on three floors, one tab each. The North Lift and the South Lift stand in the same place on every floor, at
// the left by the stairs' wall, so riding one steps out where you expect.
//
// - Ground Floor (the first tab, Wood): Hot Desks (three islands of four), a Meeting Room and a Cafe; the Walk In at
//   the entrance with the Directory beside it.
// - Level 2 (Carpet Tiles): Phone Booths (six Office Pods in two rows), a Quiet Room, two meeting rooms and a Restroom.
// - Level 3 (Parquet): the Event Floor (a Stage, two Screens, Bring Focus and twenty chairs either side of a centre
//   aisle), a Green Room and a Roof Bar.
//
// Indoors, every room's Door opens onto the floor's open space (campusPlan, IndoorRoom). Each builder is pure: it
// takes a centre (cx, cy) and returns a fresh Element[], floors first.

import { createShape, type Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import { campusPlan, type IndoorRoom } from './template-campus-parts';

const W = 2200;

// The lifts, the same on every floor, and a Directory beside them on the floors arrived at by lift.
const LIFTS: OfficePiece[] = [
  { kind: 'elevator', x: 60, y: 300, label: 'North Lift' },
  { kind: 'elevator', x: 60, y: 700, label: 'South Lift' },
];
const LIFT_DIRECTORY: OfficePiece = { kind: 'directory', x: 190, y: 520 };

const stools = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => ({ kind: 'bar-stool' as const, x, y }));

const seats = (xs: readonly number[], ys: readonly number[]): OfficePiece[] =>
  ys.flatMap((y) => xs.map((x) => ({ kind: 'chair' as const, x, y, facing: 's' as const })));

// An island of four desks, two facing two.
const island = (x: number, y: number): OfficePiece[] => [
  { kind: 'desk', x, y, facing: 'n' },
  { kind: 'desk', x: x + 136, y, facing: 'n' },
  { kind: 'desk', x, y: y + 112, facing: 's' },
  { kind: 'desk', x: x + 136, y: y + 112, facing: 's' },
];

// A meeting room: a table, a Screen on the back wall and a plant, its door in the bottom wall.
function meetingRoom(name: string, x: number, y: number, w: number): IndoorRoom {
  return {
    name,
    x,
    y,
    w,
    h: 360,
    indoor: true,
    door: { side: 's', at: w / 2, sign: 1 },
    pieces: [
      { kind: 'screen', x: 24, y: 44, w: 110 },
      // Right of the Screen, so the Screen hangs clear of it.
      { kind: 'meeting-table', x: w - 272, y: 70 },
      { kind: 'plant', x: 30, y: 250 },
    ],
  };
}

// --- Ground Floor ------------------------------------------------------------------------

const GROUND_H = 1260;
const GROUND_MID = W / 2;

const GROUND_ROOMS: IndoorRoom[] = [
  {
    name: 'Hot Desks',
    x: 300,
    y: 60,
    w: 1100,
    h: 540,
    indoor: true,
    door: { side: 's', at: 550, sign: 1 },
    pieces: [
      // Three islands of four, 120 px apart, and a notice board, coffee and water along the front.
      ...island(40, 80),
      ...island(416, 80),
      ...island(792, 80),
      { kind: 'notice-board', x: 40, y: 380 },
      // A print corner and a bank of lockers for the hot-deskers (docs/specs/009-elements/office-amenities.md), both
      // clear of the door's way in.
      { kind: 'copier', x: 232, y: 384 },
      { kind: 'printer', x: 352, y: 430 },
      { kind: 'lockers', x: 640, y: 392 },
      { kind: 'coffee-machine', x: 820, y: 420 },
      { kind: 'water-cooler', x: 920, y: 410 },
    ],
  },
  meetingRoom('Meeting Room', 1460, 60, 680),
  {
    name: 'Cafe',
    x: 1460,
    y: 600,
    w: 680,
    h: 460,
    indoor: true,
    door: { side: 's', at: 560, sign: -1 },
    pieces: [
      { kind: 'bar', x: 40, y: 40 },
      { kind: 'coffee-machine', x: 300, y: 50 },
      ...stools([60, 120, 180, 240], 170),
      { kind: 'chair', x: 40, y: 360, facing: 'w' },
      { kind: 'chair', x: 124, y: 360, facing: 'e' },
      { kind: 'water-cooler', x: 440, y: 40 },
      { kind: 'fridge', x: 516, y: 24 },
      { kind: 'plant', x: 600, y: 44 },
    ],
  },
];

const GROUND_FLOOR: OfficePiece[] = [
  ...LIFTS,
  // The entrance lounge: a sofa on its rug and plants, the Directory beside the door.
  { kind: 'rug', x: 500, y: 820 },
  { kind: 'sofa', x: 524, y: 840, facing: 'n' },
  { kind: 'plant', x: 300, y: 1120 },
  { kind: 'plant', x: 1380, y: 1120 },
  { kind: 'directory', x: GROUND_MID + 60, y: 1110 },
  // A coat rack and an umbrella stand inside the entrance, beside the Directory.
  { kind: 'coat-rack', x: GROUND_MID + 160, y: 1110 },
  { kind: 'umbrella-stand', x: GROUND_MID + 220, y: 1172 },
];

export function buildTowerGround(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: GROUND_H,
    rooms: GROUND_ROOMS,
    open: GROUND_FLOOR,
    title: {
      text: 'Co-working Tower',
      width: 340,
      sticker: 'emoji-laptop',
      subtitle:
        'Three floors to work on: hot desks and the cafe here, phone booths on Level 2, events on Level 3.',
    },
    gateAt: GROUND_MID,
    hint: 'Press Walk In (or W) and come in at the entrance. The North and South Lifts go to every floor.',
  });
}

// --- Level 2 -----------------------------------------------------------------------------

const L2_H = 1020;

const L2_ROOMS: IndoorRoom[] = [
  {
    name: 'Phone Booths',
    x: 300,
    y: 60,
    w: 800,
    h: 580,
    indoor: true,
    door: { side: 's', at: 400, sign: 1 },
    pieces: [
      // Two rows of three Office Pods, an aisle between the rows.
      ...[40, 220, 400].map((x) => ({ kind: 'office-pod' as const, x, y: 60 })),
      ...[40, 220, 400].map((x) => ({ kind: 'office-pod' as const, x, y: 324 })),
      { kind: 'water-cooler', x: 700, y: 60 },
      { kind: 'plant', x: 700, y: 300 },
    ],
  },
  {
    name: 'Quiet Room',
    x: 1180,
    y: 60,
    w: 460,
    h: 400,
    indoor: true,
    door: { side: 's', at: 230, sign: 1 },
    pieces: [
      ...[30, 160].map((x) => ({ kind: 'bookshelf' as const, x, y: 40 })),
      ...[20, 140].map((x) => ({ kind: 'desk' as const, x, y: 180, facing: 's' as const })),
      { kind: 'plant', x: 380, y: 50 },
    ],
  },
  // A restroom off the open floor below the Quiet Room (docs/specs/009-elements/office-amenities.md "Restroom"), its
  // door low in its right wall and signed there, its basins and plant along the back wall, clear of the way in.
  {
    name: 'Restroom',
    x: 1000,
    y: 700,
    w: 480,
    h: 260,
    indoor: true,
    door: { side: 'e', at: 210, sign: -1 },
    pieces: [
      { kind: 'toilet-cubicle', x: 16, y: 40 },
      { kind: 'toilet-cubicle', x: 112, y: 40 },
      { kind: 'hand-dryer', x: 220, y: 64 },
      { kind: 'washbasin', x: 264, y: 44 },
      { kind: 'washbasin', x: 344, y: 44 },
      { kind: 'plant', x: 420, y: 40 },
    ],
  },
  meetingRoom('Meeting Room A', 1720, 60, 420),
  {
    ...meetingRoom('Meeting Room B', 1720, 600, 420),
    door: { side: 'w', at: 260, sign: 1 },
    // Its door in the left wall, so its plant stands on the right.
    pieces: [
      { kind: 'screen', x: 24, y: 44, w: 110 },
      { kind: 'meeting-table', x: 148, y: 70 },
      { kind: 'plant', x: 340, y: 250 },
    ],
  },
];

export function buildTowerLevel2(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: L2_H,
    rooms: L2_ROOMS,
    open: [...LIFTS, LIFT_DIRECTORY, { kind: 'plant', x: 900, y: 860 }],
    title: {
      text: 'Level 2',
      width: 160,
      sticker: 'emoji-phone',
      subtitle: 'Phone booths for calls, a quiet room to focus, two meeting rooms and a restroom.',
    },
  });
}

// --- Level 3 -----------------------------------------------------------------------------

const L3_H = 1180;
const EVENT = { x: 300, y: 60, w: 1120, h: 640 };

const L3_ROOMS: IndoorRoom[] = [
  {
    name: 'Event Floor',
    ...EVENT,
    indoor: true,
    door: { side: 's', at: 560, sign: 1 },
    pieces: [
      { kind: 'stage', x: 320, y: 48, w: 480, h: 150, stageCameras: true },
      { kind: 'screen', x: 60, y: 44, w: 176 },
      { kind: 'screen', x: 960, y: 44, w: 140 },
      // Two rows of five either side of a 160 px aisle up from the door, 120 px between the rows.
      ...seats([92, 170, 248, 326, 404], [290, 494]),
      ...seats([640, 718, 796, 874, 952], [290, 494]),
    ],
  },
  {
    name: 'Green Room',
    x: 1500,
    y: 60,
    w: 400,
    h: 360,
    indoor: true,
    door: { side: 's', at: 200, sign: -1 },
    pieces: [
      { kind: 'water-cooler', x: 20, y: 40 },
      { kind: 'coffee-machine', x: 90, y: 50 },
      { kind: 'rug', x: 180, y: 140 },
      { kind: 'sofa', x: 204, y: 160, facing: 'n' },
      { kind: 'chair', x: 122, y: 158, facing: 'w' },
      { kind: 'plant', x: 330, y: 44 },
    ],
  },
  {
    name: 'Roof Bar',
    x: 1500,
    y: 600,
    w: 640,
    h: 480,
    indoor: true,
    door: { side: 'w', at: 320, sign: 1 },
    pieces: [
      // The counter along the back wall away from the door's side, the sofa an aisle in front of its stools.
      { kind: 'bar', x: 200, y: 40 },
      { kind: 'drinks-fridge', x: 460, y: 36 },
      ...stools([220, 280, 340, 400], 170),
      { kind: 'jukebox', x: 560, y: 60 },
      { kind: 'rug', x: 360, y: 340 },
      { kind: 'sofa', x: 384, y: 360, facing: 'n' },
    ],
  },
];

export function buildTowerLevel3(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: L3_H,
    rooms: L3_ROOMS,
    open: [...LIFTS, LIFT_DIRECTORY, { kind: 'plant', x: 1100, y: 960 }],
    title: {
      text: 'Level 3',
      width: 160,
      sticker: 'emoji-microphone',
      subtitle:
        'The event floor for talks and launches, a green room for speakers and the roof bar after.',
    },
    extra: (left, top) => [createShape('focus-button', left + EVENT.x + 820, top + EVENT.y + 64)],
  });
}
