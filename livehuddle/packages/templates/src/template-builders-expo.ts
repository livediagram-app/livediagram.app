// The Expo Hall (docs/specs/012-collaboration/virtual-office-template.md "More Spaces"): a trade show on one open floor
// (the tab's Concrete). Along the top, a Food Court, a Speaker Lounge and a Meeting Room, each closed with a Door onto
// the hall; in the middle, the keynote Stage with Bring Focus and twelve chairs either side of a centre aisle; either
// side of it, sponsor booths, twelve Office Pods in rows of three, aisles of at least 160 px between the rows and the
// stage. The Avatar Pad waits at the entrance below, with the Directory beside it. Built with campusPlan
// (template-campus-parts.ts): indoors a Door opens onto the hall's open floor, so no Garden Path runs from it.
//
// Pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import { createShape, type Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import { campusPlan, type IndoorRoom } from './template-campus-parts';

const W = 2200;
const H = 1460;
const MID = W / 2;
// The keynote stage, its chairs either side of a 160 px aisle, and the booth rows either side of them.
const STAGE_Y = 800;
const CHAIR_ROWS = [1000, 1204];
const AISLE_HALF = 80;
const BOOTH_ROWS = [800, 1064];
const LEFT_BOOTHS = [60, 240, 420];
const RIGHT_BOOTHS = [1604, 1784, 1964];

const chairsAt = (xs: readonly number[]): OfficePiece[] =>
  CHAIR_ROWS.flatMap((y) =>
    xs.map((x) => ({ kind: 'chair' as const, x, y, facing: 's' as const })),
  );

const booths = (xs: readonly number[]): OfficePiece[] =>
  BOOTH_ROWS.flatMap((y) => xs.map((x) => ({ kind: 'office-pod' as const, x, y })));

const ROOMS: IndoorRoom[] = [
  {
    name: 'Food Court',
    x: 60,
    y: 60,
    w: 700,
    h: 540,
    indoor: true,
    // Its door at the right, clear of the booths below it.
    door: { side: 's', at: 640, sign: -1 },
    pieces: [
      // Two counters with their stools, coffee between them, and two tables an aisle in front.
      { kind: 'bar', x: 40, y: 40 },
      { kind: 'coffee-machine', x: 300, y: 50 },
      { kind: 'bar', x: 400, y: 40 },
      ...[60, 120, 180, 240, 420, 480, 540, 600].map((x) => ({
        kind: 'bar-stool' as const,
        x,
        y: 170,
      })),
      { kind: 'meeting-table', x: 40, y: 354 },
      { kind: 'meeting-table', x: 400, y: 354 },
    ],
  },
  {
    name: 'Speaker Lounge',
    x: 820,
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
    name: 'Meeting Room',
    x: 1300,
    y: 60,
    w: 460,
    h: 400,
    indoor: true,
    door: { side: 's', at: 230, sign: 1 },
    pieces: [
      { kind: 'screen', x: 24, y: 44, w: 110 },
      { kind: 'meeting-table', x: 170, y: 90 },
      { kind: 'plant', x: 380, y: 300 },
    ],
  },
];

const FLOOR: OfficePiece[] = [
  // The keynote: the stage in the middle, its chairs in front of it.
  { kind: 'stage', x: MID - 240, y: STAGE_Y, w: 480, h: 150, stageCameras: true },
  // Its curtains and podium, and four pillars between the booths and the seats
  // (docs/specs/009-elements/venue-pieces.md "In the templates").
  { kind: 'stage-curtains', x: MID - 240, y: STAGE_Y - 36, w: 480 },
  { kind: 'podium', x: MID + 80, y: STAGE_Y + 30 },
  ...BOOTH_ROWS.flatMap((y) => [
    { kind: 'pillar' as const, x: 668, y },
    { kind: 'pillar' as const, x: W - 668 - 48, y },
  ]),
  ...chairsAt([MID - AISLE_HALF - 232, MID - AISLE_HALF - 154, MID - AISLE_HALF - 76]),
  ...chairsAt([MID + AISLE_HALF, MID + AISLE_HALF + 78, MID + AISLE_HALF + 156]),
  // The sponsor booths, rows of three either side.
  ...booths(LEFT_BOOTHS),
  ...booths(RIGHT_BOOTHS),
  // Along the top right, beside the meeting room: a notice board of the day's talks and plants.
  { kind: 'notice-board', x: 1860, y: 120 },
  // The free corner by the Meeting Room: a Vending Machine and a Team Photo Wall for the show's photos
  // (docs/specs/009-elements/piece-moments.md).
  { kind: 'vending-machine', x: 2080, y: 120 },
  { kind: 'photo-wall', x: 1820, y: 470 },
  // A cloakroom corner by the entrance: Lockers, a Coat Rack and an Umbrella Stand.
  { kind: 'lockers', x: 120, y: 1310 },
  { kind: 'coat-rack', x: 280, y: 1310 },
  { kind: 'umbrella-stand', x: 352, y: 1374 },
  { kind: 'plant', x: 1820, y: 340 },
  { kind: 'plant', x: 2080, y: 340 },
  // The Directory beside the entrance.
  { kind: 'directory', x: MID + 120, y: 1320 },
];

export function buildExpoHall(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: H,
    rooms: ROOMS,
    open: FLOOR,
    title: {
      text: 'Expo Hall',
      width: 240,
      sticker: 'emoji-microphone',
      subtitle:
        'A day at the show: the keynote on the stage, a sponsor in every booth, lunch in the food court.',
    },
    // In the aisle between the stage's two rows of chairs, the booths either side.
    arrival: {
      dx: 0,
      dy: 364,
      hintW: 360,
      hint: 'You arrive on the Avatar Pad in front of the stage. Step into a booth to talk to its sponsor.',
    },
    extra: (left, top) => [createShape('focus-button', left + MID + 260, top + STAGE_Y + 10)],
  });
}
