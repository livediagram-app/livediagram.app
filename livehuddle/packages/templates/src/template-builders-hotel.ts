// The Hotel and Suites (docs/specs/012-collaboration/virtual-office-template.md "Spaces with floors"): a hotel on three
// floors, one tab each, joined by named Elevators.
//
// - Lobby (the first tab, Marble): a Lobby Bar, a Ballroom with a Stage, a Business Centre and a Library Lounge round
//   an open lobby with a reception, sofas on rugs, four Columns and the Lobby Lift; the Avatar Pad at the front door.
// - Suites (Carpet): six suites either side of a corridor, the Suites Lift, a Directory and an Avatar Pad at its end.
// - Rooftop (Decking): a Rooftop Bar, a Spa Room of two Office Pods, a terrace of umbrellas, hammocks and a garden
//   round a Swimming Pool, the Rooftop Lift, a Directory and an Avatar Pad.
//
// Indoors, every room's Door opens onto the floor's open lobby or corridor (campusPlan, IndoorRoom). Each builder is
// pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import { createShape, type Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import { campusPlan, type IndoorRoom } from './template-campus-parts';

const lift = (x: number, y: number, label: string): OfficePiece => ({
  kind: 'elevator',
  x,
  y,
  label,
});

const stools = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => ({ kind: 'bar-stool' as const, x, y }));

const seats = (xs: readonly number[], ys: readonly number[]): OfficePiece[] =>
  ys.flatMap((y) => xs.map((x) => ({ kind: 'chair' as const, x, y, facing: 's' as const })));

// --- Lobby -------------------------------------------------------------------------------

const LOBBY_W = 2200;
const LOBBY_H = 1300;
const LOBBY_MID = LOBBY_W / 2;
const BALLROOM = { x: 700, y: 60, w: 760, h: 600 };

const LOBBY_ROOMS: IndoorRoom[] = [
  {
    name: 'Lobby Bar',
    x: 60,
    y: 60,
    w: 560,
    h: 560,
    indoor: true,
    door: { side: 's', at: 140, sign: 1 },
    pieces: [
      { kind: 'bar', x: 40, y: 40 },
      { kind: 'drinks-cabinet', x: 300, y: 36 },
      { kind: 'drinks-fridge', x: 410, y: 36 },
      ...stools([60, 120, 180, 240], 170),
      { kind: 'rug', x: 280, y: 350 },
      { kind: 'sofa', x: 304, y: 370, facing: 'n' },
    ],
  },
  {
    name: 'Ballroom',
    ...BALLROOM,
    indoor: true,
    door: { side: 's', at: 380, sign: 1 },
    pieces: [
      { kind: 'stage', x: 200, y: 48, stageCameras: true },
      { kind: 'screen', x: 40, y: 44, w: 140 },
      // Two rows of three either side of a 160 px aisle up from the door.
      ...seats([68, 146, 224], [280, 484]),
      ...seats([460, 538, 616], [280, 484]),
    ],
  },
  {
    name: 'Business Centre',
    x: 1540,
    y: 60,
    w: 600,
    h: 360,
    indoor: true,
    door: { side: 's', at: 300, sign: 1 },
    pieces: [
      { kind: 'meeting-table', x: 40, y: 80 },
      { kind: 'screen', x: 330, y: 44, w: 176 },
      { kind: 'plant', x: 520, y: 250 },
    ],
  },
  {
    name: 'Library Lounge',
    x: 1540,
    y: 640,
    w: 600,
    h: 360,
    indoor: true,
    door: { side: 'w', at: 180, sign: 1 },
    pieces: [
      ...[110, 240, 370].map((x) => ({ kind: 'bookshelf' as const, x, y: 40 })),
      { kind: 'rug', x: 200, y: 210 },
      { kind: 'sofa', x: 224, y: 230, facing: 'n' },
      { kind: 'fireplace', x: 450, y: 200 },
    ],
  },
];

const LOBBY_FLOOR: OfficePiece[] = [
  // The reception: a Reception Desk facing the front door, its bell for arrivals, a plant either side
  // (docs/specs/009-elements/workday-pieces.md).
  { kind: 'reception-desk', x: 1000, y: 880 },
  { kind: 'plant', x: 910, y: 890 },
  { kind: 'plant', x: 1234, y: 890 },
  // Sofas on rugs to wait on.
  { kind: 'rug', x: 300, y: 860 },
  { kind: 'sofa', x: 324, y: 880, facing: 'n' },
  { kind: 'rug', x: 300, y: 1080 },
  { kind: 'sofa', x: 324, y: 1100, facing: 's' },
  // Two pairs of columns either side of the way in from the front door, past the reception
  // (docs/specs/009-elements/venue-pieces.md "In the templates").
  ...[700, 860, 1276, 1436].map((x) => ({ kind: 'column' as const, x, y: 1010 })),
  // The Lobby Lift, by the bar.
  lift(80, 1000, 'Lobby Lift'),
  { kind: 'plant', x: 2060, y: 1140 },
  // The Directory beside the front door.
  { kind: 'directory', x: LOBBY_MID + 60, y: 1150 },
];

export function buildHotelLobby(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: LOBBY_W,
    height: LOBBY_H,
    rooms: LOBBY_ROOMS,
    open: LOBBY_FLOOR,
    title: {
      text: 'Hotel and Suites',
      width: 340,
      sticker: 'emoji-key',
      subtitle:
        'Three floors to stay on: the lobby, bar and ballroom here, the suites and the rooftop by the Lobby Lift.',
    },
    // In the lobby, before the reception desk, between the columns and the Directory.
    arrival: {
      dx: -68,
      dy: 476,
      hintW: 240,
      hint: 'You arrive on the Avatar Pad in the lobby. The Lobby Lift takes you up to the suites and the rooftop.',
    },
    extra: (left, top) => [
      createShape('focus-button', left + BALLROOM.x + 580, top + BALLROOM.y + 60),
    ],
  });
}

// --- Suites ------------------------------------------------------------------------------

const SUITES_W = 2260;
const SUITES_H = 1100;
const TOP_Y = 60;
const BOTTOM_Y = 700;
const SUITE_W = 600;
const SUITE_H = 400;
const SUITE_XS = [380, 1000, 1600] as const;

// A suite off the corridor: a sofa on its rug, a desk and a plant, clear of the door's way in.
function suite(name: string, x: number, top: boolean): IndoorRoom {
  return {
    name,
    x,
    y: top ? TOP_Y : BOTTOM_Y,
    w: SUITE_W,
    h: SUITE_H,
    indoor: true,
    door: { side: top ? 's' : 'n', at: 300, sign: 1 },
    pieces: top
      ? [
          { kind: 'rug', x: 60, y: 150 },
          { kind: 'sofa', x: 84, y: 170, facing: 'n' },
          { kind: 'desk', x: 420, y: 60, facing: 's' },
          { kind: 'plant', x: 520, y: 290 },
        ]
      : [
          { kind: 'rug', x: 60, y: 200 },
          { kind: 'sofa', x: 84, y: 220, facing: 's' },
          { kind: 'desk', x: 420, y: 200, facing: 's' },
          { kind: 'plant', x: 520, y: 60 },
        ],
  };
}

const SUITE_ROOMS: IndoorRoom[] = [
  ...SUITE_XS.map((x, i) => suite(`Suite ${101 + i}`, x, true)),
  ...SUITE_XS.map((x, i) => suite(`Suite ${104 + i}`, x, false)),
];

const SUITES_FLOOR: OfficePiece[] = [
  // The lift at the corridor's end, the Directory beside it, and plants along the corridor.
  lift(60, 510, 'Suites Lift'),
  { kind: 'directory', x: 200, y: 520 },
  // The floor's Avatar Pad (docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one"): in the corridor
  // past the Directory, so someone who changes floor from the tab bar arrives by the lift.
  { kind: 'avatar-pad', x: 290, y: 560 },
  { kind: 'plant', x: 2120, y: 520 },
];

export function buildHotelSuites(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: SUITES_W,
    height: SUITES_H,
    rooms: SUITE_ROOMS,
    open: SUITES_FLOOR,
    title: {
      text: 'Suites',
      width: 160,
      sticker: 'emoji-key',
      subtitle:
        'Six suites off one corridor, each with a sofa and a desk. The Suites Lift is at the end.',
    },
  });
}

// --- Rooftop -----------------------------------------------------------------------------

const ROOF_W = 2000;
const ROOF_H = 1100;

const ROOF_ROOMS: IndoorRoom[] = [
  {
    name: 'Rooftop Bar',
    x: 60,
    y: 60,
    w: 560,
    h: 520,
    indoor: true,
    door: { side: 's', at: 140, sign: 1 },
    pieces: [
      { kind: 'bar', x: 40, y: 40 },
      { kind: 'drinks-fridge', x: 300, y: 36 },
      ...stools([60, 120, 180, 240], 170),
      { kind: 'jukebox', x: 440, y: 60 },
      { kind: 'rug', x: 280, y: 320 },
      { kind: 'sofa', x: 304, y: 340, facing: 'n' },
    ],
  },
  {
    name: 'Spa Room',
    x: 1380,
    y: 60,
    w: 560,
    h: 400,
    indoor: true,
    door: { side: 's', at: 280, sign: 1 },
    pieces: [
      { kind: 'office-pod', x: 40, y: 150 },
      { kind: 'office-pod', x: 224, y: 150 },
      // A treadmill in the corner, which shows you as On a Break while you walk it.
      { kind: 'treadmill', x: 416, y: 160 },
      { kind: 'plant', x: 470, y: 44 },
    ],
  },
];

const TERRACE: OfficePiece[] = [
  // The rooftop pool between the two rooms, planters at its ends (docs/specs/009-elements/venue-pieces.md).
  { kind: 'swimming-pool', x: 700, y: 120, w: 600, h: 200 },
  { kind: 'outdoor-plant', x: 700, y: 360 },
  { kind: 'outdoor-plant', x: 1228, y: 360 },
  // Umbrellas and hammocks across the terrace.
  { kind: 'garden-umbrella', x: 700, y: 640 },
  { kind: 'garden-umbrella', x: 900, y: 640 },
  { kind: 'hammock', x: 1150, y: 820 },
  { kind: 'hammock', x: 1450, y: 820 },
  { kind: 'outdoor-plant', x: 1860, y: 960 },
  // The lift and the Directory beside it.
  lift(60, 880, 'Rooftop Lift'),
  { kind: 'directory', x: 200, y: 890 },
  // The floor's Avatar Pad, past the Directory, under the Rooftop Bar.
  { kind: 'avatar-pad', x: 300, y: 920 },
];

export function buildHotelRooftop(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: ROOF_W,
    height: ROOF_H,
    rooms: ROOF_ROOMS,
    open: TERRACE,
    title: {
      text: 'Rooftop',
      width: 180,
      sticker: 'emoji-sun',
      subtitle: 'A terrace above the city: the rooftop bar, the spa room, hammocks and the pool.',
    },
  });
}
