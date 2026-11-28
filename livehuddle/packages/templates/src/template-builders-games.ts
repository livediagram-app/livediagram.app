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
// Each is drawn at its final size for the 3D view (virtual-office-template.md "Laid out for the 3D view"): rooms side
// by side share a wall, wall pieces stand flush on a wall facing in, seats face what they are for.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import type { TemplateNote } from './template-notes';
import { campusPlan, type IndoorRoom } from './template-campus-parts';
import { against, besideX, belowY, standAt, withSigns, sofaOnRug } from './template-3d-place';

// A row of Bar Stools, their sitters facing up at the counter, models centred on `y`.
const stools = (xs: readonly number[], y: number): OfficePiece[] =>
  xs.map((x) => standAt('bar-stool', x, y, 's'));

// Three Bean Bags side by side along the bottom of a round rug, its top left at (x, y), facing up across it.
const beanBags = (x: number, y: number): OfficePiece[] => [
  { kind: 'rug', x, y, variant: 'round' },
  ...[10, 80, 150].map((dx) => standAt('bean-bag', x + dx, y + 140, 's')),
];

// The arrival's offset from the plan's centre for a point (x, y) on a site `width` x `height` (campusPlan centres
// the site under the band where its heading stood).
const padAt = (width: number, height: number, x: number, y: number) => ({
  dx: x - width / 2,
  dy: 96 + y - (96 + height + 120) / 2,
});

// --- Arcade Lounge -----------------------------------------------------------------

// The arcade's board: what is on, and how the rooms work.
const ARCADE_NOTES: readonly TemplateNote[] = [
  {
    title: 'Tournament night',
    text: 'Moon Mail tournament every Friday at 6. The top three on the High Scores take the Party Room for the next hour.',
    color: 'pink',
  },
  {
    title: 'The Prize Counter',
    text: 'Walk up to the counter by the doors and ring its bell, and everyone near it hears.',
    color: 'yellow',
  },
  {
    title: 'Party Room',
    text: 'Its glass walls show whether it is free. If it is in use, knock on its sign and wait to be let in.',
    color: 'blue',
  },
];

const ROW_H = 620;
const SNACK = { x: 75, y: 75, w: 830, h: ROW_H };
const PARTY = { x: besideX(SNACK), y: 75, w: 650, h: ROW_H };
const CHILL = { x: besideX(PARTY), y: 75, w: 700, h: ROW_H };
// The arcade floor under them, a room of its own sharing their front wall, its entrance in its front wall.
const FLOOR = { x: 75, y: belowY(SNACK), w: CHILL.x + CHILL.w - 75, h: 900 };
const ARCADE_W = FLOOR.x + FLOOR.w + 75;
const ARCADE_H = FLOOR.y + FLOOR.h + 75;
// The two banks of machines, each an L of two rows of five against the floor's walls: five down a side wall and five
// along the front wall, the players standing in front of them (models' middles along the wall).
const SIDE_ROW = [220, 320, 420, 520, 620];
const FRONT_ROW = [200, 280, 360, 440, 520];

const ARCADE_ROOMS = (): IndoorRoom[] => [
  {
    name: 'Snack Bar',
    ...SNACK,
    indoor: true,
    door: { side: 's', at: 415, sign: 1 },
    pieces: [
      // The counter and its stools, then coffee, the Vending Machine and the fridge along the back wall.
      against('bar', 'n', 200, SNACK),
      ...stools([110, 170, 230, 290], 126),
      against('coffee-machine', 'n', 420, SNACK),
      against('vending-machine', 'n', 520, SNACK),
      against('drinks-fridge', 'n', 620, SNACK),
      against('plant', 'n', 770, SNACK),
      // Two tables to share, either side of the way in.
      { kind: 'meeting-table', x: 90, y: 330 },
      { kind: 'meeting-table', x: 520, y: 330 },
    ],
  },
  {
    name: 'Party Room',
    ...PARTY,
    indoor: true,
    // Glass, so the party is seen from the arcade floor, its door a sliding glass one.
    glass: true,
    door: { side: 's', at: 325, sign: 1, variant: 'sliding' },
    pieces: [
      against('screen', 'n', 325, PARTY),
      { kind: 'meeting-table', x: 209, y: 230 },
      against('drinks-fridge', 'e', 200, PARTY),
      against('plant', 'w', 540, PARTY),
      against('plant', 'e', 540, PARTY),
    ],
  },
  {
    name: 'Chill Lounge',
    ...CHILL,
    indoor: true,
    door: { side: 's', at: 350, sign: -1 },
    pieces: [
      // The high scores' wall of photos, and the Jukebox.
      against('photo-wall', 'n', 200, CHILL),
      against('jukebox', 'n', 560, CHILL),
      // Three Bean Bags on a round rug, and a sofa against the right wall on its rug, an aisle between them.
      ...beanBags(80, 230),
      ...sofaOnRug('e', 330, CHILL, { w: 140, h: 200 }),
      against('plant', 'w', 540, CHILL),
    ],
  },
  {
    name: 'Arcade Floor',
    ...FLOOR,
    indoor: true,
    door: { side: 's', at: FLOOR.w / 2, sign: 1 },
    pieces: [
      ...SIDE_ROW.map((y) => against('arcade-machine', 'w', y, FLOOR)),
      ...FRONT_ROW.map((x) => against('arcade-machine', 's', x, FLOOR)),
      ...SIDE_ROW.map((y) => against('arcade-machine', 'e', y, FLOOR)),
      ...FRONT_ROW.map((x) => against('arcade-machine', 's', FLOOR.w - x, FLOOR)),
      // Bean Bags inside each bank, between it and the pad.
      ...beanBags(280, 300),
      ...beanBags(FLOOR.w - 440, 300),
      // The Prize Counter by the entrance, facing it, the Directory on the other side of the way in.
      standAt('reception-desk', FLOOR.w / 2 - 260, 700),
      standAt('directory', FLOOR.w / 2 + 240, 740),
      // The arcade's Notice Board on the back wall between the doors, its notes pinned already (template-notes.ts).
      against('notice-board', 'n', 720, FLOOR, { notes: ARCADE_NOTES }),
      against('plant', 'n', 60, FLOOR),
      against('plant', 'n', FLOOR.w - 60, FLOOR),
    ],
  },
];

export function buildArcadeLounge(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: ARCADE_W,
    height: ARCADE_H,
    rooms: withSigns(ARCADE_ROOMS()),
    // Each room's sign hangs inside it by its Door, as its Door opens onto the floor's own room.
    signs: false,
    open: [],
    // On the arcade floor between the two Bean Bag islands.
    arrival: padAt(ARCADE_W, ARCADE_H, FLOOR.x + FLOOR.w / 2, FLOOR.y + 450),
  });
}

// --- Games Night Den ---------------------------------------------------------------

const DEN = { x: 75, y: 75, w: 1100, h: 700 };
const GAMES = { x: besideX(DEN), y: 75, w: 700, h: 700 };
const KITCHEN = { x: besideX(GAMES), y: 75, w: 560, h: 700 };
// The hall along the front, sharing the three rooms' front wall, the front door in its own.
const HALL = { x: 75, y: belowY(DEN), w: KITCHEN.x + KITCHEN.w - 75, h: 520 };
const DEN_W = HALL.x + HALL.w + 75;
const DEN_H = HALL.y + HALL.h + 75;

const DEN_ROOMS = (): IndoorRoom[] => [
  {
    name: 'Den',
    ...DEN,
    indoor: true,
    door: { side: 's', at: 900, sign: 1 },
    windows: [
      { side: 'n', at: 250 },
      { side: 'n', at: 700 },
    ],
    pieces: [
      // The fire on the back wall with the dog's bed beside it, shelves of games along the wall.
      against('fireplace', 'n', 550, DEN),
      standAt('pet-bed', 690, 120),
      against('bookshelf', 'n', 840, DEN),
      against('bookshelf', 'n', 970, DEN),
      against('bookshelf', 'n', 110, DEN),
      // A sofa against the front wall facing the fire across a bordered rug, a chair either side turned in to it.
      ...sofaOnRug('s', 550, DEN, { w: 240, h: 180, variant: 'bordered' }),
      standAt('chair', 380, 300, 'w'),
      standAt('chair', 720, 300, 'e'),
      // Two games tables, either side of the lounge.
      { kind: 'meeting-table', x: 70, y: 420 },
      { kind: 'meeting-table', x: 820, y: 350 },
    ],
  },
  {
    name: 'Games Room',
    ...GAMES,
    indoor: true,
    door: { side: 's', at: 350, sign: 1 },
    pieces: [
      against('jukebox', 'n', 90, GAMES),
      // The Pool Table with room for the cues all round, the Foosball Table below it.
      standAt('pool-table', 330, 260),
      // The Dartboard on the back wall, its oche clear of the pool cues.
      against('dartboard', 'n', 590, GAMES),
      standAt('foosball-table', 330, 470),
      against('plant', 'e', 620, GAMES),
    ],
  },
  {
    name: 'Kitchen',
    ...KITCHEN,
    indoor: true,
    door: { side: 's', at: 280, sign: 1 },
    windows: [
      { side: 'e', at: 350 },
      { side: 'n', at: 470 },
    ],
    pieces: [
      // Snacks and drinks along the back wall: the fridge, a counter with the microwave on it, the sink with the
      // kettle, and coffee; a table to eat at.
      against('fridge', 'n', 80, KITCHEN),
      against('kitchen-counter', 'n', 192, KITCHEN),
      standAt('microwave', 192, 58),
      against('kitchen-sink', 'n', 306, KITCHEN),
      standAt('kettle', 320, 58),
      against('coffee-machine', 'w', 300, KITCHEN),
      { kind: 'meeting-table', x: 164, y: 330 },
      against('plant', 'e', 620, KITCHEN),
    ],
  },
  {
    name: 'Hall',
    ...HALL,
    indoor: true,
    door: { side: 's', at: 1000, sign: 1 },
    pieces: [
      // A Reading Nook by the left wall looking over a rug, and by the front door a coat rack, an umbrella stand and
      // the mat.
      against('reading-nook', 'w', 280, HALL),
      { kind: 'rug', x: 190, y: 220 },
      standAt('coat-rack', 860, 440),
      standAt('umbrella-stand', 920, 450),
      { kind: 'rug', x: 940, y: 400, variant: 'doormat' },
      standAt('directory', 1250, 300),
      against('plant', 'n', 60, HALL),
      against('plant', 'e', 420, HALL),
    ],
  },
];

export function buildGamesNightDen(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: DEN_W,
    height: DEN_H,
    rooms: withSigns(DEN_ROOMS()),
    // Each room's sign hangs inside it by its Door, as its Door opens onto the floor's own room.
    signs: false,
    open: [],
    // In the hall, in front of the Den's door.
    arrival: padAt(DEN_W, DEN_H, DEN.x + 900, HALL.y + 260),
  });
}

// --- Sports Bar --------------------------------------------------------------------

const BAR = { x: 75, y: 75, w: 1200, h: 775 };
const LOUNGE = { x: besideX(BAR), y: 75, w: 1200, h: 775 };
// The games floor across the front, sharing both rooms' front wall, its entrance in its front wall.
const GAMES_FLOOR = { x: 75, y: belowY(BAR), w: LOUNGE.x + LOUNGE.w - 75, h: 800 };
const SPORTS_W = GAMES_FLOOR.x + GAMES_FLOOR.w + 75;
const SPORTS_H = GAMES_FLOOR.y + GAMES_FLOOR.h + 75;

const SPORTS_ROOMS = (): IndoorRoom[] => [
  {
    name: 'Bar',
    ...BAR,
    indoor: true,
    door: { side: 's', at: 950, sign: -1 },
    pieces: [
      // The back bar: the Drinks Cabinet, two counters and the Drinks Fridge along the back wall, the stools in front.
      against('drinks-cabinet', 'n', 90, BAR),
      against('bar', 'n', 290, BAR),
      against('bar', 'n', 540, BAR),
      against('drinks-fridge', 'n', 740, BAR),
      // The Dartboard on the back wall, the oche in front of it kept clear.
      against('dartboard', 'n', 1000, BAR),
      against('plant', 'n', 1150, BAR),
      ...stools([200, 260, 320, 380, 440, 500, 560, 620], 126),
      // Two tables an aisle in front of the stools.
      { kind: 'meeting-table', x: 150, y: 430 },
      { kind: 'meeting-table', x: 560, y: 430 },
    ],
  },
  {
    name: 'Screen Lounge',
    ...LOUNGE,
    indoor: true,
    glass: true,
    door: { side: 's', at: 600, sign: 1, variant: 'sliding' },
    pieces: [
      // Two Screens for the match, the Clock between them for the kick-offs.
      against('screen', 'n', 300, LOUNGE),
      against('world-clock', 'n', 600, LOUNGE),
      against('screen', 'n', 900, LOUNGE),
      against('plant', 'n', 1130, LOUNGE),
      // Three sofas on rugs in the front row facing the Screens, two against the front wall behind them either side
      // of the way in.
      ...[250, 600, 950].flatMap((x): OfficePiece[] => [
        { kind: 'rug', x: x - 100, y: 420 },
        standAt('sofa', x, 470, 's'),
      ]),
      ...sofaOnRug('s', 250, LOUNGE),
      ...sofaOnRug('s', 950, LOUNGE),
    ],
  },
  {
    name: 'Games Floor',
    ...GAMES_FLOOR,
    indoor: true,
    door: { side: 's', at: GAMES_FLOOR.w / 2, sign: 1 },
    pieces: [
      // The fixtures on a Notice Board on the back wall.
      against('notice-board', 'n', 300, GAMES_FLOOR),
      // Two Ping-Pong Tables side by side, and pool and foosball across the floor.
      standAt('ping-pong-table', 450, 400),
      standAt('ping-pong-table', 850, 400),
      standAt('pool-table', 1520, 420),
      standAt('foosball-table', 1960, 420),
      // The Jukebox and the Vending Machine against the right wall.
      against('jukebox', 'e', 200, GAMES_FLOOR),
      against('vending-machine', 'e', 320, GAMES_FLOOR),
      standAt('directory', GAMES_FLOOR.w / 2 - 200, 700),
      against('plant', 'w', 700, GAMES_FLOOR),
      against('plant', 'e', 700, GAMES_FLOOR),
    ],
  },
];

export function buildSportsBar(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: SPORTS_W,
    height: SPORTS_H,
    rooms: withSigns(SPORTS_ROOMS()),
    // Each room's sign hangs inside it by its Door, as its Door opens onto the floor's own room.
    signs: false,
    open: [],
    // On the games floor, between the ping-pong and the pool, below the Bar's door.
    arrival: padAt(SPORTS_W, SPORTS_H, GAMES_FLOOR.x + 1160, GAMES_FLOOR.y + 400),
  });
}
