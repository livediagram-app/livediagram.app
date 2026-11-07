// The Beach Offsite (docs/specs/012-collaboration/virtual-office-template.md "More Spaces"): a team's day away on the
// sand (the tab's Sand floor). Along the top, a lagoon (a Pond), a Tiki Bar and a Beach Hut to meet in, each closed
// with a Door; a stone path along the beach in front of them meets the path up from the Avatar Pad at a small round
// junction; below it, hammocks under the palms, a campfire circle of benches, garden umbrellas and a swimming pool. No fence: a beach
// is open, and the Avatar Pad waits where the path comes up off the road. Built with campusPlan
// (template-campus-parts.ts), spacious by the same rule as the campuses.
//
// Pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import {
  campusPlan,
  JUNCTION,
  PATH,
  plaza,
  plazaReach,
  run,
  type CampusRoom,
} from './template-campus-parts';

const W = 2000;
const H = 1200;
// Where the path comes up off the road, and the path along the beach in front of the huts.
const GATE = 600;
const WALK_Y = 560;
const ROOM_Y = 60;
const ROOM_H = 420;
const JOIN_Y = WALK_Y + PATH / 2;
const JOIN_IN = plazaReach(JUNCTION);
// How far each hut's door path runs down to the beach path.
const DOWN = WALK_Y - ROOM_Y - ROOM_H;

const ROOMS: CampusRoom[] = [
  {
    name: 'Tiki Bar',
    x: 760,
    y: ROOM_Y,
    w: 520,
    h: ROOM_H,
    door: { side: 's', at: 260, sign: 1, reach: DOWN },
    pieces: [
      { kind: 'bar', x: 40, y: 40 },
      { kind: 'drinks-fridge', x: 300, y: 36 },
      ...[60, 120, 180, 240].map((x) => ({ kind: 'bar-stool' as const, x, y: 170 })),
      { kind: 'jukebox', x: 420, y: 60 },
      { kind: 'plant', x: 430, y: 300 },
    ],
  },
  {
    name: 'Beach Hut',
    x: 1360,
    y: ROOM_Y,
    w: 560,
    h: ROOM_H,
    door: { side: 's', at: 280, sign: 1, reach: DOWN },
    pieces: [
      { kind: 'screen', x: 24, y: 44, w: 140 },
      { kind: 'meeting-table', x: 164, y: 110 },
      { kind: 'plant', x: 470, y: 50 },
    ],
  },
];

const BEACH: OfficePiece[] = [
  // The beach path in two halves, each ending at the junction's rim (the huts' door paths end under it), the path up
  // from the road, and the junction over their ends.
  run('garden-path', 160, WALK_Y, GATE - JOIN_IN - 160, PATH),
  run('garden-path', GATE + JOIN_IN, WALK_Y, 1900 - GATE - JOIN_IN, PATH),
  run('garden-path', GATE - PATH / 2, JOIN_Y + JOIN_IN, PATH, H - JOIN_Y - JOIN_IN),
  plaza(GATE, JOIN_Y, JUNCTION),
  // The lagoon, and palms beside it.
  { kind: 'pond', x: 60, y: 70, w: 560, h: 300 },
  { kind: 'tree', x: 650, y: 120, w: 80 },
  { kind: 'tree', x: 1290, y: 300, w: 64 },
  // Hammocks under the palms, left of the path up.
  { kind: 'tree', x: 60, y: 690 },
  { kind: 'hammock', x: 200, y: 760 },
  { kind: 'tree', x: 380, y: 690 },
  { kind: 'hammock', x: 120, y: 1010 },
  { kind: 'tree', x: 300, y: 960 },
  // The campfire circle: a bench either side of the fire and one in front of it.
  { kind: 'bench', x: 800, y: 830 },
  { kind: 'campfire', x: 988, y: 836 },
  { kind: 'bench', x: 1120, y: 830 },
  { kind: 'bench', x: 960, y: 980 },
  // Garden umbrellas along the beach, and planters.
  { kind: 'garden-umbrella', x: 1420, y: 700 },
  { kind: 'garden-umbrella', x: 1660, y: 700 },
  // A swimming pool below the umbrellas (docs/specs/009-elements/venue-pieces.md), planters either side.
  { kind: 'swimming-pool', x: 1400, y: 900, w: 440, h: 200 },
  { kind: 'outdoor-plant', x: 1300, y: 1080 },
  { kind: 'outdoor-plant', x: 1880, y: 960 },
  // The Directory beside the path up, where you arrive.
  { kind: 'directory', x: GATE + 50, y: 1040 },
];

export function buildBeachOffsite(cx: number, cy: number): Element[] {
  return campusPlan(cx, cy, {
    width: W,
    height: H,
    rooms: ROOMS,
    open: BEACH,
    title: {
      text: 'Beach Offsite',
      width: 300,
      sticker: 'emoji-sun',
      subtitle:
        'A day away together: plan in the beach hut, then the tiki bar, the hammocks and the campfire.',
    },
    gateAt: GATE,
    hint: 'You arrive on the Avatar Pad by the path up the beach. The Directory by it walks you to any hut.',
  });
}
