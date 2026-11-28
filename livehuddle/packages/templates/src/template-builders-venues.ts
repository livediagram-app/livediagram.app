// The Music Hall (docs/specs/012-collaboration/virtual-office-template.md "Venues"): a gig venue on one tab, closed rooms
// round a foyer that is a room of its own (campusPlan, IndoorRoom), every room sharing its walls with the next, drawn at
// its final size for the 3D view (virtual-office-template.md "Laid out for the 3D view").
//
// - Main Hall: a Stage with Stage Curtains, and two Screens, a standing floor in front of the stage where
//   everyone arrives, and twenty chairs in two rows either side of a centre aisle up from the door.
// - Green Room backstage, its door onto the hall by the stage; the Foyer Bar below it; the Cloakroom and the Foyer
//   along the front, with four Columns, the Merch Stand and the Directory.
//
// Pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import type { TemplateNote } from './template-notes';
import { campusPlan, type IndoorRoom } from './template-campus-parts';
import { against, besideX, belowY, standAt, withSigns, sofaOnRug } from './template-3d-place';

const HALL = { x: 75, y: 75, w: 1400, h: 1000 };
const GREEN = { x: besideX(HALL), y: 75, w: 650, h: 450 };
const BAR = { x: GREEN.x, y: belowY(GREEN), w: 650, h: HALL.y + HALL.h - belowY(GREEN) };
const CLOAK = { x: 75, y: belowY(HALL), w: 525, h: 560 };
const FOYER = { x: besideX(CLOAK), y: CLOAK.y, w: BAR.x + BAR.w - besideX(CLOAK), h: 560 };
const W = FOYER.x + FOYER.w + 75;
const H = FOYER.y + FOYER.h + 75;

// Ten chairs a row either side of the centre aisle, two rows, facing the stage.
const seats = (xs: readonly number[], ys: readonly number[]): OfficePiece[] =>
  ys.flatMap((y) => xs.map((x) => standAt('chair', x, y, 's')));

const LINE_UP: readonly TemplateNote[] = [
  {
    title: 'Tonight’s line-up',
    text: 'Doors at 7. Support act on the Main Stage at 7:30, headliner at 8:30. Grab a drink at the Foyer Bar between sets.',
    color: 'pink',
  },
  {
    title: 'Front of the stage',
    text: 'The standing floor is in front of the stage, the seats behind it. Whoever plays from the Stage is heard by the whole hall.',
    color: 'yellow',
  },
  {
    title: 'Coats and bags',
    text: 'Leave them in the Cloakroom off the foyer. Performers, the Green Room is backstage: knock on its sign.',
    color: 'blue',
  },
];

const rooms = (): IndoorRoom[] => [
  {
    name: 'Main Hall',
    ...HALL,
    indoor: true,
    door: { side: 's', at: 700, sign: 1 },
    pieces: [
      { kind: 'stage', x: 460, y: 48, w: 480, h: 150, stageCameras: true },
      { kind: 'stage-curtains', x: 460, y: 12, w: 480 },
      against('screen', 'n', 200, HALL),
      against('screen', 'n', 1200, HALL),
      ...seats([270, 350, 430, 510, 590], [590, 800]),
      ...seats([830, 910, 990, 1070, 1150], [590, 800]),
    ],
  },
  {
    name: 'Foyer Bar',
    ...BAR,
    indoor: true,
    door: { side: 's', at: 120, sign: 1 },
    pieces: [
      against('jukebox', 'w', 150, BAR),
      against('drinks-fridge', 'n', 140, BAR),
      against('drinks-cabinet', 'n', 240, BAR),
      against('bar', 'n', 400, BAR),
      ...[310, 370, 430, 490].map((x) => standAt('bar-stool', x, 126, 's')),
      against('plant', 'n', 600, BAR),
      // A sofa on the right wall over its rug.
      ...sofaOnRug('e', 400, BAR, { w: 140, h: 200 }),
    ],
  },
  {
    name: 'Green Room',
    ...GREEN,
    indoor: true,
    // Backstage: its door onto the hall beside the stage.
    door: { side: 'w', at: 300, sign: 1 },
    pieces: [
      against('water-cooler', 'n', 70, GREEN),
      against('coffee-machine', 'n', 160, GREEN),
      against('drinks-fridge', 'n', 260, GREEN),
      against('plant', 'n', 590, GREEN),
      // A sofa on the right wall over its rug, a chair facing it.
      ...sofaOnRug('e', 280, GREEN, { w: 140, h: 200 }),
      standAt('chair', 330, 280, 'w'),
    ],
  },
  {
    name: 'Cloakroom',
    ...CLOAK,
    indoor: true,
    door: { side: 'e', at: 280, sign: 1 },
    pieces: [
      against('coat-rack', 'n', 80, CLOAK),
      against('coat-rack', 'n', 160, CLOAK),
      against('lockers', 'n', 330, CLOAK),
      against('umbrella-stand', 'w', 300, CLOAK),
      against('plant', 's', 460, CLOAK),
    ],
  },
  {
    name: 'Foyer',
    ...FOYER,
    indoor: true,
    door: { side: 's', at: 760, sign: 1 },
    pieces: [
      standAt('column', 300, 180),
      standAt('column', 300, 400),
      standAt('column', 1250, 180),
      standAt('column', 1250, 400),
      // The Merch Stand: the line-up on the wall behind its counter.
      against('notice-board', 'n', 760, FOYER, { notes: LINE_UP }),
      standAt('reception-desk', 760, 260),
      standAt('directory', 560, 470),
      against('plant', 's', 60, FOYER),
      against('plant', 's', FOYER.w - 60, FOYER),
    ],
  },
];

export function buildMusicHall(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: H,
    rooms: withSigns(rooms()),
    // Each room's sign hangs inside it by its Door, as its Door opens onto another room.
    signs: false,
    open: [],
    // On the standing floor in front of the stage.
    arrival: { dx: HALL.x + 700 - W / 2, dy: 96 + HALL.y + 380 - (96 + H + 120) / 2 },
  });
}
