// The Recreation Spaces (docs/specs/012-collaboration/virtual-office-template.md "Spaces"): a Rooftop Bar and a Cafe,
// somewhere to unwind together, furnished from the bar pieces (a Bar, Bar Stools, a Drinks Cabinet and a Drinks
// Fridge), sofas and chairs. Built with spacePlan (template-office-parts.ts).
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.
//
// Drawn at their final size for the 3D view (virtual-office-template.md "Laid out for the 3D view").

import type { Element } from '@livehuddle/document';
import { arrival } from './template-arrival';
import {
  SPACE_BELOW,
  SPACE_HEAD,
  spacePlan,
  type OfficePiece,
  type OfficeRoom,
} from './template-office-parts';
import { against, standAt, sofaOnRug } from './template-3d-place';

// A row of Bar Stools, their sitters facing up at the counter, models centred on `y`.
function stools(xs: readonly number[], y: number): OfficePiece[] {
  return xs.map((x) => standAt('bar-stool', x, y, 's'));
}

// A lounge by the front wall: a sofa against it facing up over its rug, a chair beside the rug turned to the sofa
// (`side` the side of the sofa the chair stands on). `at` is the sofa's middle along the wall.
function lounge(at: number, room: { w: number; h: number }, side: 'left' | 'right'): OfficePiece[] {
  return [
    ...sofaOnRug('s', at, room),
    side === 'right'
      ? standAt('chair', at + 170, room.h - 180, 'e')
      : standAt('chair', at - 170, room.h - 180, 'w'),
  ];
}

// --- Rooftop Bar -------------------------------------------------------------------

const ROOF = { w: 1375, h: 775 };

export function buildRooftopBar(cx: number, cy: number): Element[] {
  const width = ROOF.w;
  const height = SPACE_HEAD + ROOF.h + SPACE_BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const rooms: OfficeRoom[] = [
    {
      name: 'Rooftop Bar',
      x: 0,
      y: 0,
      ...ROOF,
      door: 's',
      pieces: [
        // Along the back: a tree in each corner, the Drinks Cabinet, the long Bar of two counters and the fridge.
        standAt('tree', 80, 130),
        against('drinks-cabinet', 'n', 220, ROOF),
        against('bar', 'n', 440, ROOF),
        against('bar', 'n', 680, ROOF),
        against('drinks-fridge', 'n', 880, ROOF),
        standAt('tree', ROOF.w - 80, 130),
        ...stools([350, 410, 470, 530, 590, 650, 710, 770], 128),
        // Two lounges either side of the doorway.
        ...lounge(300, ROOF, 'right'),
        ...lounge(ROOF.w - 300, ROOF, 'left'),
        // A Hammock on each side wall, Outdoor Plants by the way in.
        against('hammock', 'w', 380, ROOF),
        against('hammock', 'e', 380, ROOF),
        against('outdoor-plant', 'w', 640, ROOF),
        against('outdoor-plant', 'e', 640, ROOF),
      ],
    },
  ];
  return spacePlan(
    x0,
    y0,
    rooms,
    // On the terrace between the Bar and the lounges.
    arrival({ x: cx, y: y0 + SPACE_HEAD + 400 }),
  );
}

// --- Cafe --------------------------------------------------------------------------

const CAFE = { w: 1250, h: 725 };

export function buildCafe(cx: number, cy: number): Element[] {
  const width = CAFE.w;
  const height = SPACE_HEAD + CAFE.h + SPACE_BELOW;
  const x0 = cx - width / 2;
  const y0 = cy - height / 2;
  const rooms: OfficeRoom[] = [
    {
      name: 'Cafe',
      x: 0,
      y: 0,
      ...CAFE,
      door: 's',
      windows: [
        { side: 's', at: 275 },
        { side: 's', at: 990 },
        { side: 'w', at: 375 },
      ],
      pieces: [
        // The counter with its stools, coffee and the fridge along the back wall.
        against('bar', 'n', 160, CAFE),
        ...stools([70, 130, 190, 250], 128),
        against('coffee-machine', 'n', 360, CAFE),
        against('drinks-fridge', 'n', 460, CAFE),
        // Two tables on the right, a pair of chairs facing each other in the middle.
        { kind: 'meeting-table', x: 920, y: 150 },
        { kind: 'meeting-table', x: 920, y: 450 },
        standAt('chair', 465, 380, 'w'),
        standAt('chair', 545, 380, 'e'),
        // The sofa nook: a sofa against the front wall over its rug, the dog's bed beside it.
        ...sofaOnRug('s', 220, CAFE),
        standAt('pet-bed', 410, 640),
        against('plant', 'n', 1190, CAFE),
        against('plant', 's', 1190, CAFE),
      ],
    },
  ];
  return spacePlan(
    x0,
    y0,
    rooms,
    // In the middle of the cafe, the counter on one side and the tables on the other.
    arrival({ x: x0 + 720, y: y0 + SPACE_HEAD + 300 }),
  );
}
