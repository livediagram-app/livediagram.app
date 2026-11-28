// The Expo Hall (docs/specs/012-collaboration/virtual-office-template.md "More Spaces"): a trade show on one floor (the
// tab's Concrete), the Expo Floor, a room of its own. Along the top, a Food Court, a Speaker Lounge and a Meeting Room,
// each closed with a Door onto the floor, their front walls its back wall; in the middle of the floor, the keynote
// Stage and twelve chairs either side of a centre aisle; either side of it, sponsor booths, twelve Office Pods in rows
// of three, aisles of at least 160 px between the rows and the stage. The Avatar Pad waits in the aisle behind the
// seats, the Directory by the entrance. Built with campusPlan (template-campus-parts.ts), drawn at its final size for
// the 3D view (virtual-office-template.md "Laid out for the 3D view").
//
// Pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import type { TemplateNote } from './template-notes';
import { campusPlan, type IndoorRoom } from './template-campus-parts';
import { against, besideX, belowY, standAt, withSigns, sofaOnRug } from './template-3d-place';

const FOOD = { x: 75, y: 75, w: 875, h: 675 };
const LOUNGE = { x: besideX(FOOD), y: 75, w: 500, h: 675 };
const MEETING = { x: besideX(LOUNGE), y: 75, w: 575, h: 675 };
const FLOOR = { x: 75, y: belowY(FOOD), w: 2675, h: 1100 };
const W = FLOOR.x + FLOOR.w + 75;
const H = FLOOR.y + FLOOR.h + 75;
// The floor's middle, and the keynote stage's top on it.
const MID = FLOOR.w / 2;
const STAGE_Y = 250;
// The seats' rows (models' middles) and how far either side of the middle the centre aisle reaches.
const CHAIR_ROWS = [500, 710];
const AISLE_HALF = 80;
// The booths: two rows of three either side of the stage, an aisle between the rows.
const BOOTH_ROWS = [220, 560];
const LEFT_BOOTHS = [100, 290, 480];
const RIGHT_BOOTHS = LEFT_BOOTHS.map((x) => FLOOR.w - x - 176);

const chairsAt = (xs: readonly number[]): OfficePiece[] =>
  CHAIR_ROWS.flatMap((y) => xs.map((x) => standAt('chair', x, y, 's')));

const booths = (xs: readonly number[]): OfficePiece[] =>
  BOOTH_ROWS.flatMap((y) => xs.map((x) => ({ kind: 'office-pod' as const, x, y })));

const PROGRAMME: readonly TemplateNote[] = [
  {
    title: 'Today’s talks',
    text: 'Keynote on the stage at 10. Product demos at 11:30 and 2. Closing panel at 4.',
    color: 'yellow',
  },
  {
    title: 'Floor plan',
    text: 'Sponsor booths line both sides of the hall, the stage in the middle. The Food Court, the Speaker Lounge and the Meeting Room are along the top.',
    color: 'blue',
  },
  {
    title: 'Meet a sponsor',
    text: 'Walk into a booth to talk: each one is a call of its own. Book the Meeting Room for longer chats and knock on its sign.',
    color: 'green',
  },
  {
    title: 'Speakers',
    text: 'The Speaker Lounge is yours before your slot. Leave your coat in the cloakroom corner by the entrance.',
    color: 'purple',
  },
];

const rooms = (): IndoorRoom[] => [
  {
    name: 'Food Court',
    ...FOOD,
    indoor: true,
    door: { side: 's', at: 376, sign: 1 },
    pieces: [
      // Two counters along the back wall with coffee between them, their stools in front, and two tables.
      against('bar', 'n', 160, FOOD),
      against('coffee-machine', 'n', 360, FOOD),
      against('bar', 'n', 560, FOOD),
      ...[70, 130, 190, 250, 470, 530, 590, 650].map((x) => standAt('bar-stool', x, 126, 's')),
      { kind: 'meeting-table', x: 80, y: 380 },
      { kind: 'meeting-table', x: 440, y: 380 },
    ],
  },
  {
    name: 'Speaker Lounge',
    ...LOUNGE,
    indoor: true,
    door: { side: 's', at: 250, sign: -1 },
    pieces: [
      against('water-cooler', 'n', 70, LOUNGE),
      against('coffee-machine', 'n', 160, LOUNGE),
      against('plant', 'n', 440, LOUNGE),
      // A sofa on the right wall over its rug, a chair facing it.
      ...sofaOnRug('e', 380, LOUNGE, { w: 140, h: 200 }),
      standAt('chair', 200, 380, 'w'),
    ],
  },
  {
    name: 'Meeting Room',
    ...MEETING,
    indoor: true,
    door: { side: 's', at: 287, sign: 1 },
    pieces: [
      against('screen', 'n', 287, MEETING),
      { kind: 'meeting-table', x: 171, y: 220 },
      against('plant', 's', 520, MEETING),
    ],
  },
  {
    name: 'Expo Floor',
    ...FLOOR,
    indoor: true,
    door: { side: 's', at: MID, sign: 1 },
    pieces: [
      // The keynote Stage, its curtains and the speaker's Podium on it.
      { kind: 'stage', x: MID - 240, y: STAGE_Y, w: 480, h: 150, stageCameras: true },
      { kind: 'stage-curtains', x: MID - 240, y: STAGE_Y - 36, w: 480 },
      { kind: 'podium', x: MID + 80, y: STAGE_Y + 30 },
      // Four Pillars between the booths and the seats.
      ...BOOTH_ROWS.flatMap((y) => [
        standAt('pillar', 790, y + 100),
        standAt('pillar', FLOOR.w - 790, y + 100),
      ]),
      ...chairsAt([MID - AISLE_HALF - 194, MID - AISLE_HALF - 116, MID - AISLE_HALF - 38]),
      ...chairsAt([MID + AISLE_HALF + 38, MID + AISLE_HALF + 116, MID + AISLE_HALF + 194]),
      ...booths(LEFT_BOOTHS),
      ...booths(RIGHT_BOOTHS),
      // The programme, the Vending Machine and the Photo Wall on the back wall past the rooms.
      against('notice-board', 'n', 2100, FLOOR, { notes: PROGRAMME }),
      against('vending-machine', 'n', 2300, FLOOR),
      against('photo-wall', 'n', 2500, FLOOR),
      // The cloakroom corner by the entrance.
      against('lockers', 'w', 850, FLOOR),
      against('coat-rack', 's', 300, FLOOR),
      against('umbrella-stand', 's', 380, FLOOR),
      against('plant', 's', 60, FLOOR),
      against('plant', 's', FLOOR.w - 60, FLOOR),
      standAt('directory', MID + 220, 980),
    ],
  },
];

export function buildExpoHall(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: H,
    rooms: withSigns(rooms()),
    // Each room's sign hangs inside it by its Door, as every Door opens onto the Expo Floor.
    signs: false,
    open: [],
    // In the centre aisle behind the seats, facing the stage.
    arrival: { dx: FLOOR.x + MID - W / 2, dy: 96 + FLOOR.y + 870 - (96 + H + 120) / 2 },
  });
}
