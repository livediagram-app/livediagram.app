// The Homes (docs/specs/012-collaboration/virtual-office-template.md "Homes"): houses to meet in, Downstairs and Upstairs
// (and the City Townhouse's Roof Terrace) one tab each, joined by Stairs standing in the same place on every floor, so a
// climb lands where you expect. Closed rooms off a hall (campusPlan, IndoorRoom), as the Co-working Tower's floors are,
// but with no Room Signs, no Directory and no Elevator, and windows in the outside walls. The hall is a room of its
// own, its walls shared with the rooms round it, drawn at its final size for the 3D view (virtual-office-template.md
// "Laid out for the 3D view").
//
// Every floor of a house is the same size, so its Stairs stand at the same canvas point on every tab. The first floor's
// Avatar Pad waits in the hall with its how-to line; an upper floor's on the landing beside the Stairs.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import { campusPlan, FENCE, run, type CampusSite, type IndoorRoom } from './template-campus-parts';
import { against, besideX, belowY, standAt, sofaOnRug } from './template-3d-place';

type Floor = Omit<CampusSite, 'width' | 'height' | 'signs' | 'rooms'> & {
  rooms: readonly IndoorRoom[];
};
type Box = { x: number; y: number; w: number; h: number };

/** A floor of a house `width` x `height`: no Room Signs, its Stairs among its open pieces. Built when it is made. */
const houseFloor =
  (width: number, height: number, floor: () => Floor) =>
  (cx: number, cy: number): Element[] =>
    campusPlan(cx, cy, { width, height, signs: false, ...floor() });

/** A room of the house at `box`, its pieces laid out against that box. */
const room = (
  name: string,
  box: Box,
  door: IndoorRoom['door'],
  windows: IndoorRoom['windows'],
  pieces: OfficePiece[],
  glass?: true,
): IndoorRoom => ({
  name,
  ...box,
  indoor: true,
  door,
  windows,
  pieces,
  ...(glass ? { glass } : {}),
});

// The arrival's offset from the plan's centre for a site point (campusPlan centres the site under its old heading's band).
const padAt = (width: number, height: number, x: number, y: number) => ({
  dx: x - width / 2,
  dy: 96 + y - (96 + height + 120) / 2,
});
// The landing's Avatar Pad, its middle on a site point.
const landingPad = (x: number, y: number): OfficePiece => ({
  kind: 'avatar-pad',
  x: x - 64,
  y: y - 40,
});

// Two desks facing each other across a shared edge: the first's sitter above it, the second's below.
const deskPair = (x: number, y: number): OfficePiece[] => [
  { kind: 'desk', x, y, facing: 'n' },
  { kind: 'desk', x, y: y + 112, facing: 's' },
];

// Three Bean Bags side by side along the bottom of a round rug, its top left at (x, y), facing up across it.
const beanBags = (x: number, y: number): OfficePiece[] => [
  { kind: 'rug', x, y, variant: 'round' },
  ...[10, 80, 150].map((dx) => standAt('bean-bag', x + dx, y + 140, 's')),
];

// A kitchen's back wall from `x` along it: a fridge, a sink with the kettle on it, a counter with the microwave on
// it, and coffee, all flush on the wall.
const kitchenRun = (x: number, box: Box): OfficePiece[] => [
  against('fridge', 'n', x + 40, box),
  against('kitchen-sink', 'n', x + 152, box),
  standAt('kettle', x + 166, 58),
  against('kitchen-counter', 'n', x + 266, box),
  standAt('microwave', x + 266, 58),
  against('coffee-machine', 'n', x + 380, box),
];

// A toilet cubicle and a basin along a small bathroom's back wall, a plant in the corner by the door.
const bathroom = (
  name: string,
  box: Box,
  door: IndoorRoom['door'],
  windows: IndoorRoom['windows'],
): IndoorRoom =>
  room(name, box, door, windows, [
    against('toilet-cubicle', 'n', 90, box),
    against('washbasin', 'n', 230, box),
    against('plant', 's', 60, box),
  ]);

// --- Family House ------------------------------------------------------------------

// Living Room and Kitchen either side of the hall, the Cloakroom and Playroom below them; the same plan upstairs.
const F_LEFT: Box = { x: 75, y: 75, w: 900, h: 760 };
const F_HALL: Box = { x: besideX(F_LEFT), y: 75, w: 360, h: 0 };
const F_RIGHT: Box = { x: besideX(F_HALL), y: 75, w: 900, h: 760 };
const F_LOW_LEFT: Box = { x: 465, y: belowY(F_LEFT), w: F_HALL.x + 10 - 465, h: 465 };
const F_LOW_RIGHT: Box = { x: F_RIGHT.x, y: belowY(F_RIGHT), w: 900, h: 465 };
F_HALL.h = F_LOW_LEFT.y + F_LOW_LEFT.h - F_HALL.y;
const FAMILY_W = F_RIGHT.x + F_RIGHT.w + 75;
const FAMILY_H = F_HALL.y + F_HALL.h + 75;
// The Stairs at the top of the hall, the landing's pad below them.
const FAMILY_STAIRS: OfficePiece = { kind: 'stairs', x: F_HALL.x + 132, y: 130 };
const FAMILY_PAD = { x: F_HALL.x + F_HALL.w / 2, y: 450 };

const familyDownstairs = houseFloor(FAMILY_W, FAMILY_H, () => ({
  rooms: [
    room(
      'Living Room',
      F_LEFT,
      { side: 'e', at: 600, sign: 1 },
      [
        { side: 'n', at: 300 },
        { side: 'w', at: 300 },
        { side: 'w', at: 560 },
      ],
      [
        against('bookshelf', 'n', 110, F_LEFT),
        // The fire with the dog's bed beside it, and the Screen at the end of the wall.
        against('fireplace', 'n', 540, F_LEFT),
        standAt('pet-bed', 640, 150),
        against('screen', 'n', 790, F_LEFT),
        // A sofa against the front wall facing the fire across a bordered rug, a chair beside the rug turned in.
        ...sofaOnRug('s', 540, F_LEFT, { w: 240, h: 180, variant: 'bordered' }),
        standAt('chair', 380, 440, 'w'),
        against('plant', 's', 60, F_LEFT),
      ],
    ),
    room(
      'Kitchen',
      F_RIGHT,
      { side: 'w', at: 600, sign: 1 },
      [
        { side: 'n', at: 640 },
        { side: 'e', at: 260 },
        { side: 'e', at: 480 },
      ],
      [
        ...kitchenRun(40, F_RIGHT),
        against('plant', 'n', 840, F_RIGHT),
        // The family's Long Table.
        { kind: 'meeting-table', x: 170, y: 380, variant: 'long' },
      ],
    ),
    room(
      'Cloakroom',
      F_LOW_LEFT,
      { side: 'e', at: 240, sign: 1 },
      [{ side: 's', at: 250 }],
      [
        against('toilet-cubicle', 'n', 100, F_LOW_LEFT),
        against('washbasin', 'n', 250, F_LOW_LEFT),
        against('plant', 's', 60, F_LOW_LEFT),
      ],
    ),
    room(
      'Playroom',
      F_LOW_RIGHT,
      { side: 'w', at: 240, sign: 1 },
      [
        { side: 'e', at: 240 },
        { side: 's', at: 450 },
      ],
      [
        ...beanBags(150, 180),
        against('arcade-machine', 'n', 700, F_LOW_RIGHT),
        standAt('foosball-table', 560, 300),
        against('plant', 'e', 400, F_LOW_RIGHT),
      ],
    ),
    room(
      'Hall',
      F_HALL,
      { side: 's', at: F_HALL.w / 2, sign: 1 },
      [],
      [
        // Inside the front door: the coat rack, the umbrella stand and the mat.
        against('coat-rack', 's', F_HALL.w / 2 - 110, F_HALL),
        against('umbrella-stand', 's', F_HALL.w / 2 + 100, F_HALL),
        { kind: 'rug', x: 120, y: F_HALL.h - 90, variant: 'doormat' },
        against('plant', 'e', 1100, F_HALL),
      ],
    ),
  ],
  open: [FAMILY_STAIRS],
  // In the hall, below the Stairs, between the Living Room's door and the Kitchen's.
  arrival: padAt(FAMILY_W, FAMILY_H, FAMILY_PAD.x, FAMILY_PAD.y),
}));

const familyUpstairs = houseFloor(FAMILY_W, FAMILY_H, () => ({
  rooms: [
    room(
      'Study',
      F_LEFT,
      { side: 'e', at: 600, sign: 1 },
      [
        { side: 'n', at: 480 },
        { side: 'w', at: 300 },
        { side: 'w', at: 560 },
      ],
      [
        against('calendar-wall', 'n', 180, F_LEFT),
        against('bookshelf', 'n', 760, F_LEFT),
        ...deskPair(390, 300),
        // The family's photos on the front wall.
        against('photo-wall', 's', 450, F_LEFT),
        against('plant', 's', 60, F_LEFT),
      ],
    ),
    room(
      'Kids’ Room',
      F_RIGHT,
      { side: 'w', at: 600, sign: 1 },
      [
        { side: 'n', at: 160 },
        { side: 'e', at: 300 },
      ],
      [
        standAt('ping-pong-table', 450, 230),
        ...beanBags(220, 440),
        // A Reading Nook on the right wall looking over its rug.
        { kind: 'rug', x: 560, y: 540 },
        against('reading-nook', 'e', 600, F_RIGHT),
        against('plant', 'n', 840, F_RIGHT),
      ],
    ),
    bathroom('Bathroom', F_LOW_LEFT, { side: 'e', at: 240, sign: 1 }, [{ side: 's', at: 250 }]),
    room(
      'Reading Room',
      F_LOW_RIGHT,
      { side: 'w', at: 240, sign: 1 },
      [
        { side: 'e', at: 240 },
        { side: 's', at: 300 },
      ],
      [
        against('bookshelf', 'n', 260, F_LOW_RIGHT),
        against('bookshelf', 'n', 390, F_LOW_RIGHT),
        against('bookshelf', 'n', 520, F_LOW_RIGHT),
        { kind: 'rug', x: 560, y: 220 },
        against('reading-nook', 'e', 280, F_LOW_RIGHT),
        against('plant', 'n', 840, F_LOW_RIGHT),
      ],
    ),
  ],
  open: [
    FAMILY_STAIRS,
    landingPad(FAMILY_PAD.x, FAMILY_PAD.y),
    // The landing is open between the rooms either side, a plant at its end.
    standAt('plant', F_HALL.x + F_HALL.w - 60, F_LOW_RIGHT.y + 400),
  ],
}));

// --- City Townhouse ----------------------------------------------------------------

// The Kitchen-Diner across the back, the Front Room and the hall below it; upstairs the Home Office and Bathroom over
// them, the Music Room and the landing below.
const T_BACK: Box = { x: 75, y: 75, w: 1600, h: 650 };
const T_LOW_LEFT: Box = { x: 75, y: belowY(T_BACK), w: 875, h: 500 };
const T_HALL: Box = {
  x: besideX(T_LOW_LEFT),
  y: T_LOW_LEFT.y,
  w: T_BACK.x + T_BACK.w - besideX(T_LOW_LEFT),
  h: 500,
};
const T_OFFICE: Box = { x: 75, y: 75, w: 1000, h: 650 };
const T_BATH: Box = {
  x: besideX(T_OFFICE),
  y: 75,
  w: T_BACK.x + T_BACK.w - besideX(T_OFFICE),
  h: 650,
};
const TOWN_W = T_BACK.x + T_BACK.w + 75;
const TOWN_H = T_HALL.y + T_HALL.h + 75;
const TOWN_STAIRS: OfficePiece = {
  kind: 'stairs',
  x: T_HALL.x + T_HALL.w - 200,
  y: T_HALL.y + 110,
};
const TOWN_PAD = { x: T_HALL.x + 340, y: T_HALL.y + 250 };

const townDownstairs = houseFloor(TOWN_W, TOWN_H, () => ({
  rooms: [
    room(
      'Kitchen-Diner',
      T_BACK,
      { side: 's', at: 1250, sign: 1 },
      [
        { side: 'n', at: 900 },
        { side: 'n', at: 1250 },
        { side: 'w', at: 300 },
      ],
      [
        ...kitchenRun(40, T_BACK),
        against('kitchen-counter', 'n', 532, T_BACK),
        { kind: 'meeting-table', x: 200, y: 330, variant: 'long' },
        // A sofa against the garden end's wall, looking over its rug.
        ...sofaOnRug('e', 390, T_BACK, { w: 140, h: 200 }),
        against('plant', 'n', 1530, T_BACK),
      ],
    ),
    room(
      'Front Room',
      T_LOW_LEFT,
      { side: 'e', at: 250, sign: 1 },
      [
        { side: 'w', at: 250 },
        { side: 's', at: 700 },
      ],
      [
        against('bookshelf', 'n', 110, T_LOW_LEFT),
        against('screen', 'n', 450, T_LOW_LEFT),
        standAt('pet-bed', 700, 130),
        // The sofa against the front wall facing the Screen across its rug.
        ...sofaOnRug('s', 450, T_LOW_LEFT),
        against('plant', 's', 800, T_LOW_LEFT),
      ],
    ),
    room(
      'Hall',
      T_HALL,
      { side: 's', at: 300, sign: 1 },
      [{ side: 'e', at: 280 }],
      [
        against('coat-rack', 's', 150, T_HALL),
        against('umbrella-stand', 's', 90, T_HALL),
        { kind: 'rug', x: 240, y: T_HALL.h - 90, variant: 'doormat' },
        against('plant', 's', T_HALL.w - 60, T_HALL),
      ],
    ),
  ],
  open: [TOWN_STAIRS],
  arrival: padAt(TOWN_W, TOWN_H, TOWN_PAD.x, TOWN_PAD.y),
}));

const townUpstairs = houseFloor(TOWN_W, TOWN_H, () => ({
  rooms: [
    room(
      'Home Office',
      T_OFFICE,
      // Glass, so you see who is working before you knock.
      { side: 's', at: 930, sign: 1, variant: 'sliding' },
      [{ side: 'n', at: 800 }],
      [
        against('bookshelf', 'n', 110, T_OFFICE),
        against('screen', 'n', 500, T_OFFICE),
        ...deskPair(380, 250),
        standAt('standing-desk', 750, 330, 's'),
        against('plant', 'w', 560, T_OFFICE),
      ],
      true,
    ),
    bathroom('Bathroom', T_BATH, { side: 's', at: 200, sign: 1 }, [{ side: 'e', at: 300 }]),
    room(
      'Music Room',
      T_LOW_LEFT,
      { side: 'e', at: 380, sign: 1 },
      [
        { side: 'w', at: 250 },
        { side: 's', at: 700 },
      ],
      [
        against('jukebox', 'n', 90, T_LOW_LEFT),
        against('bookshelf', 'n', 220, T_LOW_LEFT),
        against('plant', 'n', 400, T_LOW_LEFT),
        // A sofa against the front wall facing the Jukebox across its rug, a Reading Nook by the right wall.
        ...sofaOnRug('s', 300, T_LOW_LEFT),
        { kind: 'rug', x: 560, y: 110, w: 120, h: 200 },
        against('reading-nook', 'e', 210, T_LOW_LEFT),
      ],
    ),
  ],
  // The landing is open between the Music Room and the house's right wall.
  open: [
    TOWN_STAIRS,
    landingPad(TOWN_PAD.x, TOWN_PAD.y),
    standAt('plant', TOWN_W - 140, TOWN_H - 140),
  ],
}));

// The roof's railing: a fence round its edge (the Stairs come up inside it).
const railing = (w: number, h: number): OfficePiece[] => [
  run('garden-fence', 0, 0, w, FENCE),
  run('garden-fence', 0, FENCE, FENCE, h - 2 * FENCE),
  run('garden-fence', w - FENCE, FENCE, FENCE, h - 2 * FENCE),
  run('garden-fence', 0, h - FENCE, w, FENCE),
];

const townRoof = houseFloor(TOWN_W, TOWN_H, () => ({
  rooms: [],
  open: [
    // The roof garden: a lawn with a picnic table under an umbrella, a hammock and a tree.
    { kind: 'grass', x: 100, y: 100, w: 800, h: 600 },
    ...railing(TOWN_W, TOWN_H),
    standAt('picnic-table', 300, 280),
    standAt('garden-umbrella', 470, 240),
    standAt('tree', 760, 220),
    standAt('hammock', 640, 560),
    standAt('outdoor-plant', 180, 600),
    // The fire pit, a bench either side of it facing in.
    standAt('bench', 1300, 260, 'n'),
    standAt('campfire', 1300, 380),
    standAt('bench', 1300, 500, 's'),
    standAt('tree', 1560, 220),
    // A plunge pool by the Stairs, planters along the rail.
    { kind: 'swimming-pool', x: 250, y: 860, w: 400, h: 250 },
    standAt('outdoor-plant', 120, TOWN_H - 100),
    standAt('outdoor-plant', 800, TOWN_H - 100),
    standAt('outdoor-plant', TOWN_W - 100, 700),
    TOWN_STAIRS,
    landingPad(TOWN_PAD.x, TOWN_PAD.y),
  ],
}));

// --- Country Cottage ---------------------------------------------------------------

// The Farmhouse Kitchen and the Snug across the back, the hall below; upstairs the Attic Studio and the Reading Room,
// the landing and the Bathroom below. The cottage garden beside the house, its gate facing the hall's side door.
const C_LEFT: Box = { x: 75, y: 75, w: 900, h: 725 };
const C_RIGHT: Box = { x: besideX(C_LEFT), y: 75, w: 650, h: 725 };
const C_HALL: Box = { x: 75, y: belowY(C_LEFT), w: C_RIGHT.x + C_RIGHT.w - 75, h: 400 };
const C_LANDING_W = 1200;
const C_BATH: Box = {
  x: 75 + C_LANDING_W - 10,
  y: C_HALL.y,
  w: C_HALL.x + C_HALL.w - (75 + C_LANDING_W - 10),
  h: 400,
};
const GARDEN = { x: C_HALL.x + C_HALL.w + 80, y: 75, w: 560, h: C_HALL.y + C_HALL.h - 75 };
const COTTAGE_W = GARDEN.x + GARDEN.w + 75;
const COTTAGE_H = C_HALL.y + C_HALL.h + 75;
const COTTAGE_STAIRS: OfficePiece = { kind: 'stairs', x: C_HALL.x + 300, y: C_HALL.y + 90 };
const COTTAGE_PAD = { x: C_HALL.x + 575, y: C_HALL.y + 220 };
// The hall's side door, and the garden's gate in its fence across from it.
const SIDE_DOOR = 200;
const GATE = 140;

// The cottage garden: a lawn fenced round, its gate in the side facing the hall.
const cottageGarden = (): OfficePiece[] => {
  const gateY = C_HALL.y + SIDE_DOOR - GATE / 2;
  return [
    { kind: 'grass', ...GARDEN },
    run('garden-fence', GARDEN.x, GARDEN.y, GARDEN.w, FENCE),
    run('garden-fence', GARDEN.x + GARDEN.w - FENCE, GARDEN.y + FENCE, FENCE, GARDEN.h - 2 * FENCE),
    run('garden-fence', GARDEN.x, GARDEN.y + GARDEN.h - FENCE, GARDEN.w, FENCE),
    run('garden-fence', GARDEN.x, GARDEN.y + FENCE, FENCE, gateY - GARDEN.y - FENCE),
    run('garden-fence', GARDEN.x, gateY + GATE, FENCE, GARDEN.y + GARDEN.h - FENCE - gateY - GATE),
    standAt('tree', GARDEN.x + 420, 220),
    standAt('outdoor-plant', GARDEN.x + 100, 180),
    // The pond, a bench below it looking over the water.
    { kind: 'pond', x: GARDEN.x + 160, y: 330 },
    standAt('bench', GARDEN.x + 280, 600, 's'),
    standAt('hammock', GARDEN.x + 300, 830),
    standAt('tree', GARDEN.x + 460, 1040),
    standAt('outdoor-plant', GARDEN.x + 120, 1080),
  ];
};

const cottageDownstairs = houseFloor(COTTAGE_W, COTTAGE_H, () => ({
  rooms: [
    room(
      'Farmhouse Kitchen',
      C_LEFT,
      { side: 's', at: 700, sign: 1 },
      [
        { side: 'w', at: 250 },
        { side: 'w', at: 500 },
      ],
      [
        against('fridge', 'n', 80, C_LEFT),
        against('kitchen-sink', 'n', 200, C_LEFT),
        standAt('kettle', 214, 58),
        // The range: a fire in the middle of the back wall.
        against('fireplace', 'n', 450, C_LEFT),
        against('kitchen-counter', 'n', 640, C_LEFT),
        against('plant', 'n', 840, C_LEFT),
        { kind: 'meeting-table', x: 334, y: 330 },
      ],
    ),
    room(
      'Snug',
      C_RIGHT,
      { side: 's', at: 325, sign: 1 },
      [{ side: 'n', at: 325 }],
      [
        // A Reading Nook on the left wall and a sofa on the right, looking at each other over a rug, the dog's bed
        // between them.
        against('reading-nook', 'w', 330, C_RIGHT),
        ...sofaOnRug('e', 330, C_RIGHT, { w: 320, h: 200 }),
        standAt('pet-bed', 325, 520),
        against('bookshelf', 'n', 540, C_RIGHT),
        against('plant', 's', 60, C_RIGHT),
      ],
    ),
    room(
      'Hall',
      C_HALL,
      { side: 's', at: 900, sign: 1 },
      [],
      [
        against('coat-rack', 's', 1080, C_HALL),
        against('umbrella-stand', 's', 1150, C_HALL),
        { kind: 'rug', x: 840, y: C_HALL.h - 90, variant: 'doormat' },
        against('plant', 'w', 300, C_HALL),
      ],
    ),
  ],
  open: [...cottageGarden(), COTTAGE_STAIRS],
  arrival: padAt(COTTAGE_W, COTTAGE_H, COTTAGE_PAD.x, COTTAGE_PAD.y),
}));

const cottageUpstairs = houseFloor(COTTAGE_W, COTTAGE_H, () => ({
  rooms: [
    room(
      'Attic Studio',
      C_LEFT,
      { side: 's', at: 450, sign: 1 },
      [
        { side: 'n', at: 700 },
        { side: 'w', at: 300 },
      ],
      [
        against('bookshelf', 'n', 110, C_LEFT),
        against('photo-wall', 'n', 420, C_LEFT),
        against('plant', 'n', 840, C_LEFT),
        standAt('standing-desk', 280, 400, 's'),
        standAt('desk', 600, 400, 's'),
      ],
    ),
    room(
      'Reading Room',
      C_RIGHT,
      { side: 's', at: 150, sign: 1 },
      [{ side: 'e', at: 520 }],
      [
        against('bookshelf', 'n', 150, C_RIGHT),
        against('bookshelf', 'n', 280, C_RIGHT),
        against('bookshelf', 'n', 500, C_RIGHT),
        // Two Reading Nooks looking at each other over a rug, a Bean Bag on it.
        against('reading-nook', 'w', 380, C_RIGHT),
        against('reading-nook', 'e', 380, C_RIGHT),
        { kind: 'rug', x: 225, y: 320 },
        standAt('bean-bag', 325, 380, 's'),
      ],
    ),
    bathroom('Bathroom', C_BATH, { side: 'w', at: 200, sign: 1 }, [{ side: 'e', at: 200 }]),
  ],
  // The landing is open, under the two rooms and beside the Bathroom.
  open: [
    COTTAGE_STAIRS,
    landingPad(COTTAGE_PAD.x, COTTAGE_PAD.y),
    standAt('plant', 140, COTTAGE_H - 140),
  ],
}));

export {
  cottageDownstairs as buildCountryCottage,
  cottageUpstairs as buildCottageUpstairs,
  familyDownstairs as buildFamilyHouse,
  familyUpstairs as buildFamilyUpstairs,
  townDownstairs as buildCityTownhouse,
  townRoof as buildTownhouseRoof,
  townUpstairs as buildTownhouseUpstairs,
};
