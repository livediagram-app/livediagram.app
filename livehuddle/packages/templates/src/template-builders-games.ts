// The Games Rooms (docs/specs/012-collaboration/virtual-office-template.md "Games Rooms"): places to play together, each
// one tab, closed rooms off an open floor as the Expo Hall is (campusPlan, IndoorRoom), built round the playable pieces
// (the Arcade Machine's Moon Mail, the Ping-Pong Table's game) and the ones that move (the Pet Bed's dog, a Vending
// Machine's can, a Fireplace stoked).
//
// - Arcade Lounge (carpet): two banks of Arcade Machines on the arcade floor, a Snack Bar, a glass Party Room and a
//   Chill Lounge across the top, a Prize Counter by the entrance.
// - Games Night Den (wood): a Den round the fire, a Games Room of pool, foosball and darts, and a Kitchen.
// - Sports Bar (wood): a Bar and a glass Screen Lounge across the top, the Games Floor of ping-pong, pool and foosball.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import { campusPlan, type IndoorRoom } from './template-campus-parts';

const stools = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => ({ kind: 'bar-stool' as const, x, y }));

// --- Arcade Lounge -----------------------------------------------------------------

const ARCADE_W = 2000;
const ARCADE_H = 1240;
// The two banks of machines, each two rows of five facing you, the players standing in the aisle in front of a row.
const BANK_ROWS = [760, 980];
const LEFT_BANK = [160, 240, 320, 400, 480];
const RIGHT_BANK = [1420, 1500, 1580, 1660, 1740];

const ARCADE_ROOMS: IndoorRoom[] = [
  {
    name: 'Snack Bar',
    x: 60,
    y: 60,
    w: 660,
    h: 500,
    indoor: true,
    door: { side: 's', at: 330, sign: 1 },
    pieces: [
      // The counter and its stools, coffee, the Vending Machine and the fridge along the back.
      { kind: 'bar', x: 40, y: 40 },
      ...stools([60, 120, 180, 240], 170),
      { kind: 'coffee-machine', x: 300, y: 48 },
      { kind: 'vending-machine', x: 392, y: 36 },
      { kind: 'drinks-fridge', x: 484, y: 36 },
      { kind: 'plant', x: 590, y: 44 },
      // A table for two on the left and a table to share on the right, either side of the way in.
      { kind: 'chair', x: 40, y: 360, facing: 'w' },
      { kind: 'chair', x: 128, y: 360, facing: 'e' },
      { kind: 'meeting-table', x: 410, y: 300 },
    ],
  },
  {
    name: 'Party Room',
    x: 780,
    y: 60,
    w: 520,
    h: 500,
    indoor: true,
    // Glass, so the party is seen from the arcade floor, its door a sliding glass one.
    glass: true,
    door: { side: 's', at: 260, sign: 1, variant: 'sliding' },
    pieces: [
      { kind: 'screen', x: 24, y: 44, w: 110 },
      { kind: 'meeting-table', x: 144, y: 150 },
      { kind: 'drinks-fridge', x: 420, y: 36 },
      { kind: 'plant', x: 30, y: 380 },
      { kind: 'plant', x: 434, y: 380 },
    ],
  },
  {
    name: 'Chill Lounge',
    x: 1380,
    y: 60,
    w: 560,
    h: 500,
    indoor: true,
    door: { side: 's', at: 280, sign: -1 },
    pieces: [
      // The high scores' wall of photos, and the Jukebox.
      { kind: 'photo-wall', x: 40, y: 40 },
      { kind: 'jukebox', x: 460, y: 40 },
      // Three Bean Bags on a round rug, and a sofa on its own rug an aisle away.
      { kind: 'rug', x: 60, y: 220, variant: 'round' },
      { kind: 'bean-bag', x: 76, y: 246 },
      { kind: 'bean-bag', x: 152, y: 246 },
      { kind: 'bean-bag', x: 114, y: 302 },
      { kind: 'rug', x: 340, y: 220 },
      { kind: 'sofa', x: 364, y: 240, facing: 'n' },
      { kind: 'plant', x: 30, y: 400 },
    ],
  },
];

const arcadeBank = (xs: readonly number[]): OfficePiece[] =>
  BANK_ROWS.flatMap((y) => xs.map((x) => ({ kind: 'arcade-machine' as const, x, y })));

const ARCADE_FLOOR: OfficePiece[] = [
  ...arcadeBank(LEFT_BANK),
  ...arcadeBank(RIGHT_BANK),
  // The Prize Counter by the entrance, the Directory on the other side of the way in.
  { kind: 'reception-desk', x: 640, y: 1060 },
  { kind: 'directory', x: ARCADE_W / 2 + 80, y: 1080 },
  { kind: 'plant', x: 300, y: 1120 },
  { kind: 'plant', x: 1640, y: 1120 },
];

export function buildArcadeLounge(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: ARCADE_W,
    height: ARCADE_H,
    rooms: ARCADE_ROOMS,
    open: ARCADE_FLOOR,
    title: {
      text: 'Arcade Lounge',
      width: 300,
      sticker: 'emoji-game',
      subtitle:
        'Twenty machines of Moon Mail, a snack bar, a party room you can see into and a lounge to chill in.',
    },
    // On the arcade floor between the two banks of machines.
    arrival: {
      dx: 0,
      dy: 188,
      hint: 'You arrive on the Avatar Pad on the arcade floor. Walk up to a machine and press it to play Moon Mail.',
    },
  });
}

// --- Games Night Den ---------------------------------------------------------------

const DEN_W = 1800;
const DEN_H = 1200;

const DEN_ROOMS: IndoorRoom[] = [
  {
    name: 'Den',
    x: 60,
    y: 60,
    w: 1060,
    h: 560,
    indoor: true,
    door: { side: 's', at: 530, sign: 1 },
    windows: [
      { side: 'n', at: 360 },
      { side: 'n', at: 700 },
    ],
    pieces: [
      // Shelves of games, the fire in the middle of the back wall with the dog's bed beside it.
      { kind: 'bookshelf', x: 40, y: 40 },
      { kind: 'bookshelf', x: 168, y: 40 },
      { kind: 'fireplace', x: 466, y: 40 },
      { kind: 'pet-bed', x: 620, y: 112 },
      { kind: 'bookshelf', x: 860, y: 40 },
      { kind: 'plant', x: 990, y: 44 },
      // A sofa on a bordered rug facing the fire, a chair either side of it.
      { kind: 'rug', x: 410, y: 200, variant: 'bordered' },
      { kind: 'chair', x: 370, y: 230, facing: 'e' },
      { kind: 'sofa', x: 454, y: 230, facing: 'n' },
      { kind: 'chair', x: 614, y: 230, facing: 'w' },
      // Two games tables, either side of the way in.
      { kind: 'meeting-table', x: 60, y: 330 },
      { kind: 'meeting-table', x: 780, y: 330 },
    ],
  },
  {
    name: 'Games Room',
    x: 1180,
    y: 60,
    w: 560,
    h: 560,
    indoor: true,
    door: { side: 's', at: 280, sign: 1 },
    windows: [{ side: 'e', at: 300 }],
    pieces: [
      { kind: 'jukebox', x: 40, y: 40 },
      { kind: 'pool-table', x: 180, y: 120 },
      // The Dartboard on the back wall, clear of the pool cues.
      { kind: 'dartboard', x: 440, y: 36 },
      { kind: 'foosball-table', x: 196, y: 330 },
      { kind: 'plant', x: 470, y: 440 },
    ],
  },
  {
    name: 'Kitchen',
    x: 1180,
    y: 800,
    w: 560,
    h: 340,
    indoor: true,
    // Its door in its top wall, onto the hall.
    door: { side: 'n', at: 160, sign: -1 },
    windows: [
      { side: 'e', at: 170 },
      { side: 's', at: 400 },
    ],
    pieces: [
      // Snacks and drinks: a counter run with the kettle and the microwave on it, the fridge and coffee.
      { kind: 'coffee-machine', x: 440, y: 50 },
      { kind: 'kitchen-counter', x: 120, y: 230 },
      { kind: 'microwave', x: 146, y: 220 },
      { kind: 'kitchen-sink', x: 232, y: 230 },
      { kind: 'kettle', x: 262, y: 222 },
      { kind: 'fridge', x: 360, y: 190 },
      { kind: 'plant', x: 30, y: 240 },
    ],
  },
];

const DEN_HALL: OfficePiece[] = [
  // A Reading Nook in the hall, and the front door's coat rack, umbrella stand and mat.
  { kind: 'reading-nook', x: 120, y: 900 },
  { kind: 'directory', x: 760, y: 1040 },
  { kind: 'coat-rack', x: 860, y: 1040 },
  { kind: 'umbrella-stand', x: 930, y: 1100 },
  { kind: 'rug', x: 530, y: 1110, variant: 'doormat' },
  { kind: 'plant', x: 300, y: 1080 },
];

export function buildGamesNightDen(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: DEN_W,
    height: DEN_H,
    rooms: DEN_ROOMS,
    open: DEN_HALL,
    title: {
      text: 'Games Night Den',
      width: 320,
      sticker: 'emoji-dice',
      subtitle:
        'Board games by the fire with the dog, pool and darts next door, and snacks in the kitchen.',
    },
    // In the hall, in front of the Den's door.
    arrival: {
      dx: -310,
      dy: 228,
      hint: 'You arrive on the Avatar Pad in the hall. Pull up a chair at a games table, or pat the dog.',
    },
  });
}

// --- Sports Bar --------------------------------------------------------------------

const SPORTS_W = 2100;
const SPORTS_H = 1260;

const SPORTS_ROOMS: IndoorRoom[] = [
  {
    name: 'Bar',
    x: 60,
    y: 60,
    w: 960,
    h: 620,
    indoor: true,
    door: { side: 's', at: 760, sign: -1 },
    pieces: [
      { kind: 'drinks-cabinet', x: 40, y: 40 },
      { kind: 'bar', x: 150, y: 40 },
      { kind: 'bar', x: 390, y: 40 },
      { kind: 'drinks-fridge', x: 650, y: 36 },
      // The Dartboard on the back wall, the oche in front of it kept clear.
      { kind: 'dartboard', x: 780, y: 36 },
      { kind: 'plant', x: 880, y: 44 },
      ...stools([170, 230, 290, 350, 410, 470, 530, 590], 170),
      // Two tables an aisle in front of the stools.
      { kind: 'meeting-table', x: 60, y: 360 },
      { kind: 'meeting-table', x: 420, y: 360 },
    ],
  },
  {
    name: 'Screen Lounge',
    x: 1080,
    y: 60,
    w: 960,
    h: 560,
    indoor: true,
    glass: true,
    door: { side: 's', at: 480, sign: 1, variant: 'sliding' },
    pieces: [
      // Two Screens for the match, the World Clock between them for the kick-offs round the world.
      { kind: 'screen', x: 120, y: 40 },
      { kind: 'world-clock', x: 396, y: 44 },
      { kind: 'screen', x: 648, y: 40 },
      { kind: 'plant', x: 880, y: 44 },
      // Three sofas on rugs in the front row, two behind an aisle back, the way in clear between them.
      ...[80, 380, 680].flatMap((x): OfficePiece[] => [
        { kind: 'rug', x, y: 220 },
        { kind: 'sofa', x: x + 24, y: 240, facing: 'n' },
      ]),
      ...[80, 680].flatMap((x): OfficePiece[] => [
        { kind: 'rug', x, y: 425 },
        { kind: 'sofa', x: x + 24, y: 445, facing: 'n' },
      ]),
    ],
  },
];

const GAMES_FLOOR: OfficePiece[] = [
  // The fixtures on a Notice Board under the Bar's wall.
  { kind: 'notice-board', x: 100, y: 700 },
  // Two Ping-Pong Tables side by side, and pool and foosball across the floor.
  { kind: 'ping-pong-table', x: 160, y: 860 },
  { kind: 'ping-pong-table', x: 504, y: 860 },
  { kind: 'pool-table', x: 1240, y: 840 },
  { kind: 'foosball-table', x: 1640, y: 852 },
  { kind: 'jukebox', x: 1900, y: 660 },
  { kind: 'vending-machine', x: 1960, y: 1080 },
  { kind: 'directory', x: SPORTS_W / 2 + 80, y: 1100 },
  { kind: 'plant', x: 400, y: 1140 },
  { kind: 'plant', x: 1600, y: 1140 },
];

export function buildSportsBar(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: SPORTS_W,
    height: SPORTS_H,
    rooms: SPORTS_ROOMS,
    open: GAMES_FLOOR,
    title: {
      text: 'Sports Bar',
      width: 240,
      sticker: 'emoji-trophy',
      subtitle:
        'The big game on the screens, a pint at the bar, and ping-pong, pool and foosball on the games floor.',
    },
    // On the games floor, between the ping-pong and the pool, below the Bar's door.
    arrival: {
      dx: -50,
      dy: 218,
      hint: 'You arrive on the Avatar Pad on the games floor. Sit at a ping-pong table to play whoever sits opposite.',
    },
  });
}
