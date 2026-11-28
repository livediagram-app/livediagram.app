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

import type { Element } from '@livehuddle/document';
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
    // The three rooms along the top share their walls (office.md "Rooms line up").
    w: 650,
    h: 560,
    indoor: true,
    door: { side: 's', at: 140, sign: 1 },
    // Windows in the building's outside walls (docs/specs/009-elements/room-builder.md "Window").
    windows: [
      { side: 'w', at: 220 },
      { side: 'w', at: 440 },
    ],
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
    windows: [{ side: 'n', at: 660 }],

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
    x: 1450,
    y: 60,
    w: 690,
    h: 360,
    indoor: true,
    door: { side: 's', at: 345, sign: 1 },
    windows: [
      { side: 'n', at: 300 },
      { side: 'e', at: 200 },
    ],
    pieces: [
      { kind: 'meeting-table', x: 40, y: 80 },
      { kind: 'screen', x: 380, y: 44, w: 176 },
      { kind: 'plant', x: 610, y: 250 },
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
    windows: [{ side: 'e', at: 120 }],
    pieces: [
      ...[110, 240, 370].map((x) => ({ kind: 'bookshelf' as const, x, y: 40 })),
      // A sofa on its rug facing the fire on the right wall.
      { kind: 'rug', x: 190, y: 150 },
      { kind: 'sofa', x: 240, y: 150, facing: 'w' },
      { kind: 'fireplace', x: 450, y: 160 },
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
  { kind: 'rug', x: 340, y: 860 },
  { kind: 'sofa', x: 364, y: 880, facing: 'n' },
  { kind: 'rug', x: 340, y: 1080 },
  { kind: 'sofa', x: 364, y: 1100, facing: 's' },
  // Two pairs of columns either side of the way in from the front door, past the reception
  // (docs/specs/009-elements/venue-pieces.md "In the templates").
  ...[700, 860, 1276, 1436].map((x) => ({ kind: 'column' as const, x, y: 1010 })),
  // The Lobby Lift, by the bar.
  lift(80, 1000, 'Lobby Lift'),
  // The Stairs beside the lift (docs/specs/009-elements/stairs.md "In the templates"), open floor below them to step
  // off onto.
  { kind: 'stairs', x: 210, y: 1000 },
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
    // In the lobby, before the reception desk, between the columns and the Directory.
    arrival: {
      dx: -68,
      dy: 476,
    },
  });
}

// --- Suites ------------------------------------------------------------------------------

const SUITES_W = 2260;
const SUITES_H = 1100;
const TOP_Y = 60;
const BOTTOM_Y = 700;
const SUITE_W = 600;
const SUITE_H = 400;
// Side by side, each a wall's width over the last so neighbours share one wall (office.md "Rooms line up").
const SUITE_XS = [380, 970, 1560] as const;

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
    // A window in every suite, in its outside wall (docs/specs/009-elements/room-builder.md "Window").
    windows: [{ side: top ? 'n' : 's', at: 300 }],
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
  // The Stairs below the lift lobby, clear of the Directory, open floor below them to step off onto.
  { kind: 'stairs', x: 200, y: 720 },
  { kind: 'plant', x: 2120, y: 520 },
];

export function buildHotelSuites(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: SUITES_W,
    height: SUITES_H,
    rooms: SUITE_ROOMS,
    open: SUITES_FLOOR,
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
    windows: [{ side: 'w', at: 260 }],
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
    windows: [
      { side: 'n', at: 140 },
      { side: 'e', at: 220 },
    ],
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
  // A Ping-Pong Table on the terrace, past the Spa Room's way out (docs/specs/009-elements/social-pieces.md).
  { kind: 'ping-pong-table', x: 1730, y: 580 },
  // The Stairs right of the Rooftop Bar's way out and its sign, the lift lobby below them.
  { kind: 'stairs', x: 370, y: 600 },
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
  });
}
