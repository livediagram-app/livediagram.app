// The Homes (docs/specs/012-collaboration/virtual-office-template.md "Homes"): houses to meet in, Downstairs and Upstairs
// (and the City Townhouse's Roof Terrace) one tab each, joined by Stairs standing in the same place on every floor, so a
// climb lands where you expect. Closed rooms off a hall (campusPlan, IndoorRoom), as the Co-working Tower's floors are,
// but with no Room Signs, no Directory and no Elevator, and windows in the outside walls.
//
// Every floor of a house is the same size, so its Stairs stand at the same canvas point on every tab. The first floor's
// Avatar Pad waits in the hall with its how-to line; an upper floor's on the landing beside the Stairs.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh Element[], floors first.

import type { Element } from '@livehuddle/document';
import type { OfficePiece } from './template-office-parts';
import { campusPlan, FENCE, run, type CampusSite, type IndoorRoom } from './template-campus-parts';

type Floor = Omit<CampusSite, 'width' | 'height' | 'signs' | 'rooms'> & {
  rooms: readonly IndoorRoom[];
};

/** A floor of a house `width` x `height`: no Room Signs, its Stairs among its open pieces. */
const houseFloor =
  (width: number, height: number, floor: Floor) =>
  (cx: number, cy: number): Element[] =>
    campusPlan(cx, cy, { width, height, signs: false, ...floor });

// Two desks facing each other across a shared edge, the first's sitter facing up.
const deskPair = (x: number, y: number): OfficePiece[] => [
  { kind: 'desk', x, y, facing: 'n' },
  { kind: 'desk', x, y: y + 112, facing: 's' },
];

// Three Bean Bags on a round rug, the rug's top left at (x, y): two side by side, one in front sharing their edge.
const beanBags = (x: number, y: number): OfficePiece[] => [
  { kind: 'rug', x, y, variant: 'round' },
  { kind: 'bean-bag', x: x + 16, y: y + 30 },
  { kind: 'bean-bag', x: x + 92, y: y + 30 },
  { kind: 'bean-bag', x: x + 54, y: y + 86 },
];

// A kitchen's back wall, from the room's top left plus (x, 0): a fridge, a sink with the kettle on it, a counter with
// the microwave on it, and coffee.
const kitchenRun = (x: number): OfficePiece[] => [
  { kind: 'fridge', x, y: 36 },
  { kind: 'kitchen-sink', x: x + 86, y: 84 },
  { kind: 'kettle', x: x + 116, y: 76 },
  { kind: 'kitchen-counter', x: x + 198, y: 84 },
  { kind: 'microwave', x: x + 224, y: 74 },
  { kind: 'coffee-machine', x: x + 326, y: 76 },
];

// A toilet cubicle, a basin and a plant along a small bathroom's back wall.
const bathroom = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  door: IndoorRoom['door'],
  windows: IndoorRoom['windows'],
): IndoorRoom => ({
  name,
  x,
  y,
  w,
  h,
  indoor: true,
  door,
  windows,
  pieces: [
    { kind: 'toilet-cubicle', x: 40, y: 40 },
    { kind: 'washbasin', x: 170, y: 44 },
    { kind: 'plant', x: 40, y: h - 110 },
  ],
});

// --- Family House ------------------------------------------------------------------

const FAMILY_W = 1900;
const FAMILY_H = 1200;
// The Stairs at the top of the hall, the landing's pad below them.
const FAMILY_STAIRS: OfficePiece = { kind: 'stairs', x: 902, y: 140 };
const FAMILY_LANDING: OfficePiece = { kind: 'avatar-pad', x: 886, y: 380 };
// The hall is 260 px wide between the Living Room and the Kitchen: the how-to line keeps inside it.
const FAMILY_HINT_W = 240;

const familyDownstairs = houseFloor(FAMILY_W, FAMILY_H, {
  rooms: [
    {
      name: 'Living Room',
      x: 60,
      y: 60,
      w: 760,
      h: 640,
      indoor: true,
      door: { side: 'e', at: 540, sign: 1 },
      windows: [
        { side: 'n', at: 238 },
        { side: 'w', at: 260 },
        { side: 'w', at: 480 },
      ],
      pieces: [
        { kind: 'bookshelf', x: 40, y: 40 },
        // The fire, the dog's bed beside it, and the Screen at the end of the wall.
        { kind: 'fireplace', x: 316, y: 40 },
        { kind: 'pet-bed', x: 460, y: 112 },
        { kind: 'screen', x: 560, y: 44, w: 150 },
        // A sofa on a bordered rug facing the fire, a chair either side.
        { kind: 'rug', x: 260, y: 230, variant: 'bordered' },
        { kind: 'chair', x: 220, y: 250, facing: 'e' },
        { kind: 'sofa', x: 304, y: 250, facing: 'n' },
        { kind: 'chair', x: 464, y: 250, facing: 'w' },
        { kind: 'plant', x: 40, y: 540 },
      ],
    },
    {
      name: 'Kitchen',
      x: 1080,
      y: 60,
      w: 760,
      h: 640,
      indoor: true,
      door: { side: 'w', at: 540, sign: 1 },
      windows: [
        { side: 'n', at: 560 },
        { side: 'e', at: 260 },
        { side: 'e', at: 480 },
      ],
      pieces: [
        ...kitchenRun(24),
        { kind: 'plant', x: 680, y: 44 },
        // The family's Long Table.
        { kind: 'meeting-table', x: 120, y: 330, variant: 'long' },
      ],
    },
    {
      name: 'Cloakroom',
      x: 60,
      y: 800,
      w: 400,
      h: 340,
      indoor: true,
      door: { side: 'e', at: 170, sign: 1 },
      windows: [{ side: 'w', at: 170 }],
      pieces: [
        { kind: 'toilet-cubicle', x: 40, y: 40 },
        { kind: 'washbasin', x: 180, y: 44 },
        { kind: 'plant', x: 40, y: 230 },
      ],
    },
    {
      name: 'Playroom',
      x: 1300,
      y: 800,
      w: 540,
      h: 340,
      indoor: true,
      door: { side: 'w', at: 170, sign: 1 },
      windows: [
        { side: 'e', at: 170 },
        { side: 's', at: 270 },
      ],
      pieces: [
        ...beanBags(160, 120),
        { kind: 'arcade-machine', x: 420, y: 40 },
        { kind: 'foosball-table', x: 340, y: 200 },
      ],
    },
  ],
  open: [
    FAMILY_STAIRS,
    // Inside the front door: the coat rack, the umbrella stand and the mat.
    { kind: 'coat-rack', x: 640, y: 1040 },
    { kind: 'umbrella-stand', x: 710, y: 1100 },
    { kind: 'rug', x: 890, y: 1120, variant: 'doormat' },
    { kind: 'plant', x: 1180, y: 1080 },
  ],
  title: {
    text: 'Family House',
    width: 280,
    sticker: 'emoji-dog',
    subtitle:
      'Downstairs: the living room by the fire, the kitchen and the playroom. The Stairs go up to the study.',
  },
  // In the hall, below the Stairs, between the Living Room's door and the Kitchen's.
  arrival: {
    dx: FAMILY_LANDING.x + 64 - FAMILY_W / 2,
    dy: FAMILY_LANDING.y + 40 - FAMILY_H / 2 - 12,
    hintW: FAMILY_HINT_W,
    hint: 'You arrive on the Avatar Pad in the hall. Walk onto the Stairs to go Upstairs.',
  },
});

const familyUpstairs = houseFloor(FAMILY_W, FAMILY_H, {
  rooms: [
    {
      name: 'Study',
      x: 60,
      y: 60,
      w: 760,
      h: 640,
      indoor: true,
      door: { side: 'e', at: 540, sign: 1 },
      windows: [
        { side: 'n', at: 420 },
        { side: 'w', at: 300 },
        { side: 'w', at: 520 },
      ],
      pieces: [
        { kind: 'calendar-wall', x: 40, y: 36 },
        { kind: 'bookshelf', x: 600, y: 40 },
        ...deskPair(300, 220),
        { kind: 'plant', x: 40, y: 540 },
      ],
    },
    {
      name: 'Kids’ Room',
      x: 1080,
      y: 60,
      w: 760,
      h: 640,
      indoor: true,
      door: { side: 'w', at: 540, sign: 1 },
      windows: [
        { side: 'n', at: 160 },
        { side: 'e', at: 260 },
        { side: 'e', at: 480 },
      ],
      pieces: [
        { kind: 'ping-pong-table', x: 300, y: 120 },
        ...beanBags(120, 330),
        { kind: 'reading-nook', x: 520, y: 420 },
        { kind: 'plant', x: 680, y: 44 },
      ],
    },
    bathroom('Bathroom', 60, 800, 400, 340, { side: 'e', at: 170, sign: 1 }, [
      { side: 'w', at: 170 },
    ]),
    {
      name: 'Reading Room',
      x: 1300,
      y: 800,
      w: 540,
      h: 340,
      indoor: true,
      door: { side: 'w', at: 170, sign: 1 },
      windows: [
        { side: 'e', at: 170 },
        { side: 's', at: 120 },
      ],
      pieces: [
        { kind: 'bookshelf', x: 140, y: 40 },
        { kind: 'bookshelf', x: 270, y: 40 },
        { kind: 'bookshelf', x: 400, y: 40 },
        { kind: 'reading-nook', x: 300, y: 190 },
        { kind: 'plant', x: 40, y: 240 },
      ],
    },
  ],
  open: [
    FAMILY_STAIRS,
    FAMILY_LANDING,
    // The family's photos on the landing wall, and a plant.
    { kind: 'photo-wall', x: 560, y: 712 },
    { kind: 'plant', x: 1180, y: 1080 },
  ],
  title: {
    text: 'Upstairs',
    width: 200,
    sticker: 'emoji-books',
    subtitle:
      'The study, the kids’ room with a ping-pong table, the reading room and the bathroom.',
  },
});

// --- City Townhouse ----------------------------------------------------------------

const TOWN_W = 1400;
const TOWN_H = 1200;
const TOWN_STAIRS: OfficePiece = { kind: 'stairs', x: 1180, y: 780 };
const TOWN_LANDING: OfficePiece = { kind: 'avatar-pad', x: 976, y: 860 };

const townDownstairs = houseFloor(TOWN_W, TOWN_H, {
  rooms: [
    {
      name: 'Kitchen-Diner',
      x: 60,
      y: 60,
      w: 1280,
      h: 520,
      indoor: true,
      door: { side: 's', at: 960, sign: 1 },
      windows: [
        { side: 'n', at: 760 },
        { side: 'n', at: 1000 },
        { side: 'w', at: 300 },
      ],
      pieces: [
        ...kitchenRun(24),
        { kind: 'kitchen-counter', x: 446, y: 84 },
        { kind: 'meeting-table', x: 80, y: 240, variant: 'long' },
        // A sofa on a rug at the garden end.
        { kind: 'rug', x: 760, y: 300 },
        { kind: 'sofa', x: 784, y: 320, facing: 'n' },
        { kind: 'plant', x: 1200, y: 44 },
      ],
    },
    {
      name: 'Front Room',
      x: 60,
      y: 760,
      w: 700,
      h: 400,
      indoor: true,
      door: { side: 'e', at: 120, sign: 1 },
      windows: [
        { side: 'w', at: 210 },
        { side: 's', at: 350 },
      ],
      pieces: [
        { kind: 'bookshelf', x: 40, y: 40 },
        { kind: 'screen', x: 250, y: 44 },
        { kind: 'pet-bed', x: 520, y: 120 },
        { kind: 'rug', x: 240, y: 200 },
        { kind: 'sofa', x: 264, y: 220, facing: 'n' },
        { kind: 'plant', x: 620, y: 300 },
      ],
    },
  ],
  open: [
    TOWN_STAIRS,
    { kind: 'coat-rack', x: 800, y: 1040 },
    { kind: 'umbrella-stand', x: 870, y: 1100 },
    { kind: 'rug', x: 1000, y: 1120, variant: 'doormat' },
    { kind: 'plant', x: 1260, y: 1080 },
  ],
  title: {
    text: 'City Townhouse',
    width: 300,
    sticker: 'emoji-key',
    subtitle:
      'Downstairs: the kitchen-diner and the front room. The Stairs go up to the office and the roof terrace.',
  },
  arrival: {
    dx: TOWN_LANDING.x + 64 - TOWN_W / 2,
    dy: TOWN_LANDING.y + 40 - TOWN_H / 2 - 12,
    hint: 'You arrive on the Avatar Pad in the hall. Walk onto the Stairs to go Upstairs.',
  },
});

const townUpstairs = houseFloor(TOWN_W, TOWN_H, {
  rooms: [
    {
      name: 'Home Office',
      x: 60,
      y: 60,
      w: 760,
      h: 520,
      indoor: true,
      // Glass, so you see who is working before you knock.
      glass: true,
      door: { side: 's', at: 380, sign: 1, variant: 'sliding' },
      windows: [{ side: 'n', at: 380 }],
      pieces: [
        { kind: 'bookshelf', x: 40, y: 40 },
        { kind: 'screen', x: 560, y: 44, w: 150 },
        ...deskPair(200, 200),
        { kind: 'standing-desk', x: 480, y: 220 },
        { kind: 'plant', x: 680, y: 420 },
      ],
    },
    bathroom('Bathroom', 900, 60, 440, 400, { side: 's', at: 220, sign: 1 }, [
      { side: 'e', at: 200 },
    ]),
    {
      name: 'Music Room',
      x: 60,
      y: 760,
      w: 700,
      h: 400,
      indoor: true,
      door: { side: 'e', at: 120, sign: 1 },
      windows: [
        { side: 'w', at: 210 },
        { side: 's', at: 350 },
      ],
      pieces: [
        { kind: 'jukebox', x: 40, y: 40 },
        { kind: 'bookshelf', x: 140, y: 40 },
        { kind: 'plant', x: 400, y: 40 },
        { kind: 'rug', x: 200, y: 220 },
        { kind: 'sofa', x: 224, y: 240, facing: 'n' },
        { kind: 'reading-nook', x: 500, y: 260 },
      ],
    },
  ],
  open: [TOWN_STAIRS, TOWN_LANDING, { kind: 'plant', x: 1260, y: 1080 }],
  title: {
    text: 'Upstairs',
    width: 200,
    sticker: 'emoji-laptop',
    subtitle: 'The glass home office, the music room and the bathroom. Up again for the roof.',
  },
});

// The roof's railing: a fence round its edge (the Stairs come up inside it).
const railing = (w: number, h: number): OfficePiece[] => [
  run('garden-fence', 0, 0, w, FENCE),
  run('garden-fence', 0, FENCE, FENCE, h - 2 * FENCE),
  run('garden-fence', w - FENCE, FENCE, FENCE, h - 2 * FENCE),
  run('garden-fence', 0, h - FENCE, w, FENCE),
];

const townRoof = houseFloor(TOWN_W, TOWN_H, {
  rooms: [],
  open: [
    // The roof garden: a lawn with a picnic table under an umbrella, a hammock and a tree.
    { kind: 'grass', x: 80, y: 80, w: 640, h: 480 },
    ...railing(TOWN_W, TOWN_H),
    { kind: 'picnic-table', x: 140, y: 160 },
    { kind: 'garden-umbrella', x: 360, y: 140 },
    { kind: 'tree', x: 560, y: 100 },
    { kind: 'hammock', x: 480, y: 400 },
    { kind: 'outdoor-plant', x: 120, y: 440 },
    // The fire pit, a bench either side of it.
    { kind: 'bench', x: 972, y: 200 },
    { kind: 'campfire', x: 1000, y: 300 },
    { kind: 'bench', x: 972, y: 400 },
    { kind: 'tree', x: 1200, y: 80 },
    // A plunge pool by the Stairs, planters along the rail.
    { kind: 'swimming-pool', x: 200, y: 760, w: 320, h: 200 },
    { kind: 'outdoor-plant', x: 80, y: 1080 },
    { kind: 'outdoor-plant', x: 640, y: 1080 },
    { kind: 'outdoor-plant', x: 1260, y: 600 },
    TOWN_STAIRS,
    TOWN_LANDING,
  ],
  title: {
    text: 'Roof Terrace',
    width: 260,
    sticker: 'emoji-sun',
    subtitle: 'A roof garden over the city: a picnic in the sun, the fire pit and a plunge pool.',
  },
});

// --- Country Cottage ---------------------------------------------------------------

const COTTAGE_W = 1900;
const COTTAGE_H = 1200;
const COTTAGE_STAIRS: OfficePiece = { kind: 'stairs', x: 300, y: 780 };
const COTTAGE_LANDING: OfficePiece = { kind: 'avatar-pad', x: 496, y: 860 };

// The cottage garden beside the house: a lawn fenced round, its gate in the side facing the hall.
const GARDEN = { x: 1420, y: 60, w: 420, h: 1080 };
const cottageGarden: OfficePiece[] = [
  { kind: 'grass', ...GARDEN },
  run('garden-fence', GARDEN.x, GARDEN.y, GARDEN.w, FENCE),
  run('garden-fence', GARDEN.x + GARDEN.w - FENCE, GARDEN.y + FENCE, FENCE, GARDEN.h - 2 * FENCE),
  run('garden-fence', GARDEN.x, GARDEN.y + GARDEN.h - FENCE, GARDEN.w, FENCE),
  run('garden-fence', GARDEN.x, GARDEN.y + FENCE, FENCE, 400),
  run('garden-fence', GARDEN.x, 700, FENCE, GARDEN.y + GARDEN.h - FENCE - 700),
  { kind: 'tree', x: 1660, y: 120 },
  { kind: 'outdoor-plant', x: 1480, y: 140 },
  { kind: 'pond', x: 1480, y: 340 },
  { kind: 'bench', x: 1520, y: 560 },
  { kind: 'hammock', x: 1600, y: 800 },
  { kind: 'tree', x: 1660, y: 920 },
  { kind: 'outdoor-plant', x: 1500, y: 960 },
];

const cottageDownstairs = houseFloor(COTTAGE_W, COTTAGE_H, {
  rooms: [
    {
      name: 'Farmhouse Kitchen',
      x: 60,
      y: 60,
      w: 720,
      h: 580,
      indoor: true,
      door: { side: 's', at: 560, sign: 1 },
      windows: [
        { side: 'w', at: 200 },
        { side: 'w', at: 440 },
      ],
      pieces: [
        { kind: 'fridge', x: 24, y: 36 },
        { kind: 'kitchen-sink', x: 110, y: 84 },
        { kind: 'kettle', x: 140, y: 76 },
        // The range: a fire in the middle of the back wall.
        { kind: 'fireplace', x: 296, y: 40 },
        { kind: 'kitchen-counter', x: 450, y: 84 },
        { kind: 'plant', x: 640, y: 44 },
        { kind: 'meeting-table', x: 200, y: 300 },
      ],
    },
    {
      name: 'Snug',
      x: 840,
      y: 60,
      w: 520,
      h: 580,
      indoor: true,
      door: { side: 's', at: 260, sign: 1 },
      windows: [{ side: 'n', at: 260 }],
      pieces: [
        { kind: 'reading-nook', x: 40, y: 60 },
        { kind: 'bookshelf', x: 360, y: 40 },
        { kind: 'rug', x: 150, y: 280 },
        { kind: 'sofa', x: 174, y: 300, facing: 'n' },
        { kind: 'pet-bed', x: 380, y: 300 },
        { kind: 'plant', x: 40, y: 460 },
      ],
    },
  ],
  open: [
    ...cottageGarden,
    COTTAGE_STAIRS,
    { kind: 'coat-rack', x: 940, y: 1040 },
    { kind: 'umbrella-stand', x: 1010, y: 1100 },
    { kind: 'rug', x: 640, y: 1120, variant: 'doormat' },
    { kind: 'plant', x: 80, y: 1100 },
  ],
  title: {
    text: 'Country Cottage',
    width: 300,
    sticker: 'emoji-sunflower',
    subtitle:
      'Downstairs: the farmhouse kitchen, the snug and the garden. The Stairs go up to the attic studio.',
  },
  arrival: {
    dx: COTTAGE_LANDING.x + 64 - COTTAGE_W / 2,
    dy: COTTAGE_LANDING.y + 40 - COTTAGE_H / 2 - 12,
    hint: 'You arrive on the Avatar Pad in the hall. The garden is through the gate, and the Stairs go Upstairs.',
  },
});

const cottageUpstairs = houseFloor(COTTAGE_W, COTTAGE_H, {
  rooms: [
    {
      name: 'Attic Studio',
      x: 60,
      y: 60,
      w: 720,
      h: 580,
      indoor: true,
      door: { side: 's', at: 560, sign: 1 },
      windows: [
        { side: 'n', at: 300 },
        { side: 'w', at: 300 },
      ],
      pieces: [
        { kind: 'bookshelf', x: 40, y: 40 },
        { kind: 'photo-wall', x: 420, y: 36 },
        { kind: 'plant', x: 640, y: 44 },
        { kind: 'standing-desk', x: 80, y: 220 },
        { kind: 'desk', x: 320, y: 220, facing: 's' },
      ],
    },
    bathroom('Bathroom', 840, 60, 400, 400, { side: 's', at: 200, sign: 1 }, [
      { side: 'e', at: 200 },
    ]),
    {
      name: 'Reading Room',
      x: 1300,
      y: 60,
      w: 540,
      h: 580,
      indoor: true,
      door: { side: 's', at: 270, sign: 1 },
      windows: [{ side: 'e', at: 300 }],
      pieces: [
        { kind: 'bookshelf', x: 40, y: 40 },
        { kind: 'bookshelf', x: 170, y: 40 },
        { kind: 'bookshelf', x: 380, y: 40 },
        { kind: 'reading-nook', x: 40, y: 220 },
        { kind: 'reading-nook', x: 320, y: 220 },
        { kind: 'bean-bag', x: 240, y: 420 },
      ],
    },
  ],
  open: [COTTAGE_STAIRS, COTTAGE_LANDING, { kind: 'plant', x: 80, y: 1100 }],
  title: {
    text: 'Upstairs',
    width: 200,
    sticker: 'emoji-art-palette',
    subtitle: 'Under the eaves: the attic studio, the reading room and the bathroom.',
  },
});

export {
  cottageDownstairs as buildCountryCottage,
  cottageUpstairs as buildCottageUpstairs,
  familyDownstairs as buildFamilyHouse,
  familyUpstairs as buildFamilyUpstairs,
  townDownstairs as buildCityTownhouse,
  townRoof as buildTownhouseRoof,
  townUpstairs as buildTownhouseUpstairs,
};
